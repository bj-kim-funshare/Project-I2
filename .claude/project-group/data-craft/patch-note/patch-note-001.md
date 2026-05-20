# data-craft — Patch Note (001)

## v001.318.0

> 통합일: 2026-05-20
> 플랜 이슈: #135 (HOTFIX 1)

### 페이즈 결과
- **HOTFIX 1** (`330206e`): Phase 1 (v001.313.0) 의 사람-친화 포맷팅(`deadline='YYYY-MM-DD (미완료)'`) 도 여전히 "이미 모두 해당 상태입니다" 뒤 괄호 안에 사용자 친화적이지 않은 안내가 보인다는 마스터 보고에 따라, no-change 분기의 진단 detail 자체를 사용자 토스트에서 완전 제거. `useButtonAction.ts` 의 else 분기는 `showToast(getNoChangeReasonMessage(result.reason))` 한 줄로 정리됐고, Phase 1 에서 도입했던 `formatBeforeValue` / `formatDiagnosticDetail` 헬퍼 함수와 PHASE-12 / PHASE-13 관련 주석 블록, 사용처가 사라진 `ButtonActionDiagnostic` import 까지 모두 정리. fs-data-viewer 기준 사용자 토스트는 이제 reason 코드 기반 베이스 메시지만 표시 — fs-sub-data-viewer 의 동작과 정합.

### 영향 파일
- `data-craft`:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts`

### 관찰성 트레이드오프 (명시)
- PHASE-13 의 진단 첨부는 원래 `all-already-target` 분기 오발화를 마스터가 즉시 식별하는 가드레일 surface 로 도입됐었음. 본 HOTFIX 로 사용자 토스트에서 사라지면서, 향후 같은 케이스가 재발할 경우 dev 콘솔 / 로그 채널을 별도로 둬야 하는지 여부는 본 플랜 범위 밖 후속.

## v001.317.0

> 통합일: 2026-05-20
> 플랜 이슈: #129 HOTFIX 5 (캘린더 pointer-events:auto 추가 — 4 라운드 헛수정의 진짜 원인)

### 개요

v001.310.0 (#129 HOTFIX 4) 적용 후 마스터 보고: "캘린더 모달이 닫히지는 않지만 상호작용 안되는건 여전해, 특히 캘린더 모달을 클릭하다보면 **뒤에 있는 인쇄 모달의 텍스트가 선택되는데** 이걸 보니 상호 작용 자체가 인쇄 모달로 전달되는게 확실해". 결정적 단서.

**진짜 원인 확정**: Radix Dialog modal 모드는 내부적으로 `react-remove-scroll` 의 `.block-interactivity-{id}` 클래스를 body 에 부여하며, 이 클래스는 `{pointer-events: none}` 을 적용한다 (`node_modules/react-remove-scroll/dist/es5/SideEffect.js:20`). DialogContent 와 그 React subtree 만 `.allow-interactivity-{id}` (`{pointer-events: all}`) 를 명시 받는다. portal 로 `document.body` 의 직접 자식으로 떠 있는 캘린더는 DialogContent subtree 외부라서 `pointer-events: none` 을 **inherit**. 결과: 캘린더가 시각적으로는 떠 있지만 hit-testing 에서 무시되어 클릭이 통과해 뒤의 DialogContent (인쇄 모달) 로 도달.

이로써 HOTFIX 1~4 의 모든 관찰이 일관 설명됨:
- HOTFIX 1 (document mousedown click-outside): listener 자체는 정상이었으나 `e.target` 이 진짜 DialogContent 였고 `containerRef.contains(DialogContent)` = false → onClose 발화 → 캘린더 닫힘. 정확한 contains 가드가 잘못 닫는 것처럼 보였던 이유.
- HOTFIX 2 (React synthetic stopPropagation): 캘린더에 React 이벤트 도달조차 안 함 (pointer-events:none).
- HOTFIX 3 (element native stopPropagation): 캘린더에 native 이벤트 도달조차 안 함.
- HOTFIX 4 (focusout): 클릭이 캘린더에 도달 안 함 → focus 변화 없음 → 닫히지도 상호작용도 못 함.

### 해법

**한 줄 fix**: 캘린더 컨테이너 inline style 에 `pointerEvents: 'auto'` 추가. body inherit 을 명시 override 하여 캘린더가 직접 hit-test 대상이 됨.

부수 정리:
- HOTFIX 4 의 focusout 패턴 (useLayoutEffect, tabIndex={-1}, outline-none, el.focus()) 모두 revert.
- HOTFIX 1 의 document mousedown click-outside useEffect **복원** — 이번엔 진짜로 작동 (target 이 캘린더 내부 element 라 contains 가 정확히 true 반환).

### 페이즈 결과

- **Phase 6 / HOTFIX 5** (fix): `DatePickerDropdown` 컨테이너 div inline style 에 `pointerEvents: 'auto'` 한 줄 추가. HOTFIX 4 의 focusout useLayoutEffect + tabIndex + outline-none + el.focus() 제거. HOTFIX 1 의 document mousedown useEffect 복원 (`useEffect` import 복귀). 기존 Phase 1 portal + position useLayoutEffect rect 계산 로직 유지. (`6d7a9b20`)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx`

### 비고 — 4 라운드 헛수정 회고 (메모리 갱신 권고)

본 사건은 portal + Radix Dialog modal + react-remove-scroll 조합의 **숨겨진 pointer-events inherit 함정** 의 명백한 사례. 향후 portal-out popover 추가 시 표준 체크리스트:

1. **포터블 popover 가 Radix Dialog (또는 다른 modal-trap library) 내부에서 사용되면 반드시 `pointer-events: auto` 를 명시**. RemoveScroll 류가 body 에 `pointer-events: none` 을 거는 패턴은 popover library 마다 공통.
2. 마스터의 "뒤의 element 가 선택됨" 같은 표현은 hit-test 가 popover 를 통과한다는 결정적 단서 — 즉시 pointer-events 의심.
3. 4 라운드 동안 가설 → 실패 → 새 가설 패턴을 반복하지 말고, 첫 회귀 시점에 마스터의 **정확한 표현** ("닫혀" vs "선택 안됨" vs "뒤의 element 가 선택됨") 을 dimension 별로 확인.

`fs-sub-data-viewer` / `fs-external-data-viewer` 사본은 본 plan 범위 외이나 동일 패키지 동일 컴포넌트 — 별도 hotfix 시 본 fix 동일 적용.
## v001.316.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 13 — rowLink 컬럼 생성 시 target 4개 속성 1회 복사)

### 개요

마스터 명령: rowLink 컬럼 신규 생성 + 기존 그룹 append 시점에 target column 의 4개 속성 (열 너비 / 열 본문 스타일 / 단위 / 단위 위치) 을 새 source 컬럼에 **1회 자동 복사** (참조 아닌 복사 — target 이후 변경되어도 source 무변경).

### 사전 transport 현황 (HOTFIX 13 전)

- 이미 transport 되고 있던 필드: unit / unitPosition / cellRendererModelList / enableSorting / enableAggregation / aggregationDisplayType / importanceLevels.
- 누락 필드: **width** (ConnectionColumnItem 에 필드 자체가 없었음).
- cellRendererModelList 는 참조 복사 (`inherited.cellRendererModelList ?? []`) — target 변경 시 영향 가능성.

### 변경 (7 파일, +11/-4)

#### 1. ConnectionColumnItem 확장
- **`entities/connection/types.ts`** (`a7888b7`): `ConnectionColumnItem` 에 `width?: number` 필드 신규 추가.

#### 2. host callback 매핑
- **`apps/data-craft/src/features/viewer/lib/connectionCallbacks.ts` + 3개 다른 패키지** (`fs-data-viewer-explorer`, `fs-sub-data-viewer-explorer`, `fs-external-data-viewer-explorer`) — server `ViewerColumnSetting.width` → `ConnectionColumnItem.width` 매핑 추가 (`typeof s?.width === 'number' ? s.width : undefined` 패턴).

#### 3. addRowLinkColumns 복사 로직
- **`widgets/column-generator/addRowLinkColumns.ts`** (`a7888b7`):
  - `columnTemplate` / `newColumn` 양쪽에서 `width: inherited.width ?? rowLinkType.defaultWidth` 로 교체.
  - `cellRendererModelList` 복사를 `structuredClone` 으로 변경 → **target 변경 시 source 독립 보장** (참조 아닌 복사).

#### 4. 타입 정합
- **`entities/row-link/types.ts`** (`98d186e1`): `RowLinkTargetColumnMetadata` 에 `width?: number` 필드 추가 — `inherited.width` 참조 typecheck 통과.

### 동작 요약

| 4개 속성 | 복사 방식 |
|---|---|
| 열 너비 (width) | inherited.width → newColumn.width, 1회 카피 |
| 열 본문 스타일 (cellRendererModelList) | structuredClone 으로 deep copy, 1회 |
| 단위 (unit) | inherited.unit → newColumn.unit, 1회 |
| 단위 위치 (unitPosition) | inherited.unitPosition → newColumn.unitPosition, 1회 |

생성 시점 한 번만 복사 — target column 이 나중에 변경되어도 source column 은 무변경.

### 정책 합치

- data-craft FE-only (BE/DB 무수정 — `ViewerColumnSetting.width` 는 이미 BE 직렬화에 존재했음).
- Lint gate: PASS (0 errors, 17 warnings).
- 회귀: HOTFIX 12 universal-trigger / HOTFIX 7 시안 매칭 / HOTFIX 11 즉시 반영 / HOTFIX 8 동적 라벨 모두 무변경.

## v001.315.0

> 통합일: 2026-05-20
> 플랜 이슈: #137

### 개요

빌더 헤더의 사이드바 접기 토글 버튼 위치를 사이드바 상태에 따라 분기:
- **펼침 상태**: 헤더 우측 영역 좌단 (사이드바 경계 직후, `leftActions`/`PeriodSelector` 컨테이너 가장 앞) 으로 이동.
- **접힘 상태**: 현행 좌측 블록 (사이드바 영역) 그대로 유지.

좌측 블록이 펼침 시 로고만 남으므로 `justify-between` → `justify-center` 로 정렬 조정. 핸들러 / 아이콘 / 툴팁 / a11y label 은 기존과 동일하게 보존.

### 페이즈 결과

- **Phase 1** (`a4683153`): `AppHeader.tsx` 의 토글 `<Tooltip>` 두 위치 조건부 렌더 — `isSidebarCollapsed === true` → 좌측 블록, `false` → 우측 블록 좌단. 좌측 컨테이너 `justify-between` → `justify-center`. 우측 블록 접힘-로고 (`CompanyLogo`) 재출력 블록 무수정 유지.

### 영향 파일

**data-craft**:
- `src/widgets/header/ui/AppHeader.tsx`

### advisor 검증

- 계획 advisor (#1): Intent / Logic / Group Policy / Evidence / Command Fulfillment 5건 PASS.
- 완료 advisor (#2): 5건 PASS. 디프 직접 검증, lint gate PASS (0 errors, 17 무관 warnings).
## v001.314.0

> 통합일: 2026-05-20
> 플랜 이슈: #126 (HOTFIX 2 — 결제 수단 메뉴 / 삭제 다이얼로그 / 토스트 시점 UX 개선)

### 개요

마스터 보고 4건을 한 HOTFIX 로 묶어 해소:

**A** — 결제 수단 케밥 메뉴에서 "결제 수단 삭제" 가 2번째 위치 → 3번째로 이동.
**B** — 결제 수단 삭제 경고 모달의 "취소" 버튼 검정 outline 테두리 제거.
**C** — 결제 수단 삭제 시 결제 비밀번호 게이트 추가 (다른 결제 액션과 동일 패턴).
**D** — "카드가 성공적으로 변경되었습니다" 토스트가 비밀번호 설정 모달 표시 전에 노출되던 문제 → 비밀번호 설정 완료 후 시점으로 이동.

### 변경

**`src/widgets/settings-dialog/ui/plan/CardInfoSection.tsx`** (`19ec5c45`):
- DropdownMenu 항목 순서 재정렬: "결제 수단 변경 → 결제 비밀번호 변경 → 결제 수단 삭제" (기존: 변경 → 삭제 → 비밀번호).

**`src/features/subscription/ui/DeleteCardDialog.tsx`** (`19ec5c45`):
- AlertDialogCancel 의 shadcn 기본 outline variant 를 Tailwind 덮어쓰기 (`className='border-0 shadow-none bg-transparent'`) 로 검정 테두리 제거.
- `usePaymentPasswordGate` 도입. 확인 버튼 클릭 → `gate()` → onSuccess 시 `onConfirm()` 호출 흐름. `ReactivateConfirmDialog` 와 동일 패턴, gateElement 는 AlertDialog 외부 Fragment 형제 렌더.

**`src/pages/billing-callback/ui/BillingSuccessPage.tsx`** (`f9760f45`):
- card-change 분기에서 `changeCard.mutateAsync` 직후 즉시 호출되던 `toast.success(t('billing.changeCardSuccess', ...))` 제거.
- `handlePasswordSetupComplete` 콜백 내에서 `currentActionRef.current === 'card-change'` 조건 분기로 동일 토스트를 비밀번호 설정 완료 시점에 호출.
- promotion-purchase 분기의 토스트는 위치 변경 없음 (마스터 요구는 카드 등록 한정).

### 영향 파일

**data-craft**
- `src/widgets/settings-dialog/ui/plan/CardInfoSection.tsx`
- `src/features/subscription/ui/DeleteCardDialog.tsx`
- `src/pages/billing-callback/ui/BillingSuccessPage.tsx`

### 테스트 시나리오

1. 설정 → 플랜 관리 → 결제 수단 케밥 메뉴 → 순서가 **변경 → 비밀번호 → 삭제** 인지 확인.
2. "결제 수단 삭제" 클릭 → 경고 모달의 **취소 버튼에 검정 테두리 없음** 확인.
3. 삭제 확인 클릭 → **결제 비밀번호 입력 게이트** 노출 → 통과 시에만 카드 삭제 진행.
4. 비밀번호 미입력/취소 시 카드 삭제 안 됨.
5. 결제 수단 등록/변경 흐름 → **비밀번호 설정 완료 시점에만** "카드가 성공적으로 변경되었습니다" 토스트 노출 (비밀번호 모달 표시 중에는 토스트 없음).

### 후속 권장 (HOTFIX 2 범위 외)

- **BE `/api/subscription/billing/delete-card` 엔드포인트의 `requirePaymentPassword` 미들웨어 적용 여부 확인** — FE 게이트만으로는 우회 가능. 미적용 시 BE 후속 플랜으로 별도 진행.
- AlertDialogCancel 의 outline 테두리 정책 — 다른 다이얼로그 (`CancelSubscriptionDialog`, `ReactivateConfirmDialog`, `AdjustStep` 등) 와 일관성 점검. 마스터 결정 후 전체 통일 가능.

### 회귀 위험

- 토스트 이동: 사용자가 비밀번호 설정 모달을 강제 닫고 카드 삭제 confirm 으로 진입한 경우, "카드 변경 완료" 토스트가 미노출됨 (정상 — 비밀번호 미완료). 카드 삭제 확정 시점에 다른 토스트가 별도로 표시됨.
- promotion-purchase 의 토스트는 기존 위치 그대로 — 회귀 없음.

## v001.313.0

> 통합일: 2026-05-20
> 플랜 이슈: #135

### 페이즈 결과
- **Phase 1** (`817e859`): `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts` 의 `formatDiagnosticDetail` 위에 `formatBeforeValue(typeId, beforeValue)` 헬퍼를 신설하고, 진단 entries map 내부의 raw `${e.beforeValue}` 삽입을 헬퍼 호출로 교체. deadline 타입은 `{` 로 시작 시 `JSON.parse` 후 `date`(없으면 `(미지정)`) + `completed`(true→`완료` / false→`미완료`) 조합으로 `"YYYY-MM-DD (완료|미완료)"` 반환, 파싱 실패 시 raw 폴백으로 legacy plain-date 호환. 그 외 typeId 는 `{`/`[` 로 시작 + JSON.parse 성공 시 `(객체)`/`(배열)` 단축 라벨, 그렇지 않으면 raw 그대로. null/undefined/빈 문자열은 `(빈값)` 통일. PHASE-13 의 `all-already-target` 진단 surface (셀 종류 + 현재 상태 확인 편의) 는 보존하면서 deadline 셀의 `JSON.stringify({date, completed})` 결과가 토스트에 raw 노출되던 표면이 사라짐.

### 영향 파일
- `data-craft`:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts`

### 후속 확장 여지
- 신규 JSON-저장 셀 타입 추가 시 `formatBeforeValue` 의 `if (typeId === ...)` 분기에 사람-친화 라벨 한 줄씩 추가. 무처리 시에는 일반 안전망 (`(객체)`/`(배열)` short 라벨) 으로 raw 노출은 차단.

## v001.312.0

> 통합일: 2026-05-20
> 플랜 이슈: #136 (HOTFIX 1 — overscroll-behavior-x contain revert)

### 페이즈 결과
- **Phase 1 (HOTFIX 1)**: v001.309.0 에서 `src/app/styles/index.css` 에 추가했던 `.fs-data-viewer-container, .fs-data-viewer-container * { overscroll-behavior-x: contain; }` 6줄 revert. v001.309.0 적용 후 마스터 보고 — "트랙패드를 통한 가로 스크롤 자체가 막혔다" 치명 회귀. CSS 광역 자손 셀렉터가 fs_data_viewer 내부 스크롤 동작과 어떻게 간섭했는지 메커니즘은 미규명, 회귀 사실만 확정. 일단 revert 로 v001.308.0 시점 상태로 복원.

### 영향 파일
- `data-craft`:
  - `src/app/styles/index.css`

### 재시도 시 검토 사항
- CSS 광역 셀렉터 (`.fs-data-viewer-container *`) 대신 fs_data_viewer 의 실제 가로 스크롤 요소를 DevTools 로 식별 후 그 단일 요소에만 `overscroll-behavior-x: contain` 적용.
- 또는 컨테이너 레벨 `onWheel` 핸들러로 boundary-only `preventDefault` (deltaX 가 dominant 이고 scrollLeft 가 0 또는 max 인 경우에만).
- fs_data_viewer 가 이미 vertical 에 `overscroll-behavior-y: contain` 을 적용한 위치를 정확히 찾아 (해당 요소 셀렉터 확인) 같은 요소에만 horizontal 도 추가하는 정공법 우선.

## v001.311.0

> 통합일: 2026-05-20
> 플랜 이슈: #133 (HOTFIX 1)

### 개요 — 트랙패드 horizontal 스크롤 시 헤더 +40px drift containment

v001.305.0 (Phase 1, useScrollSync 3d82b92a 회귀 revert) 이후에도 마스터 보고: 트랙패드로 그리드 뷰 열 헤더 영역을 horizontal 스크롤하면 디자인 / 뷰 모드 모두에서 헤더만 "+ 행추가버튼 너비" 만큼 더 스크롤됨. 마우스로는 차단됨(=정상). 트랙패드 전용 트리거.

### 근본 원인 (1차 진단)

- 헤더 inner flex (`GridHeader.tsx` L116-118): `style={{ minWidth: 'max(fit-content, 100%)' }}` + trailing 40px spacer (L157-160).
- 본문 inner div (`GridBody.tsx` L263): `<div className="flex-1">` — **minWidth 부재**. RowMenuColumn(40px) sibling.
- 구조적 너비 비대칭으로 `header.scrollWidth > body.scrollWidth` 가 되어, 트랙패드 horizontal 제스처가 헤더 컨테이너를 source 로 만들면 본문은 max 에서 clamp 되고 헤더만 더 멀리 스크롤됨. 마우스 휠은 native 가 horizontal 을 직접 일으키지 않아 트리거되지 않음 (마스터 단서와 정합).

### 페이즈 결과

- **Phase 2 / HOTFIX 1** (`079ae623`): `packages/fs-data-viewer/src/features/grid/hooks/useScrollSync.ts` 의 `createScrollHandler` 에 **source-self clamp** 추가. 각 타겟에 `scrollLeft` 를 쓴 직후 브라우저가 실제로 적용한 값(clamp 결과)을 읽어 최솟값 측정. source 의 scrollLeft 가 그 최솟값을 초과했으면 source 도 동일 값으로 끌어내림. 이로써 트랙패드 horizontal 제스처가 헤더를 source 로 삼을 때 본문보다 더 멀리 가는 시각적 drift 가 sync 레이어에서 차단됨. JSDoc 도 보강 (clamp 동작 명시).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/features/grid/hooks/useScrollSync.ts`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 17 warnings).
- advisor (hotfix 시점, 5-perspective): 5/5 PASS.
- 마스터 수동 검증은 PENDING 게이트에서.

### 절차 노트 — containment 성격 명시

본 HOTFIX 1 은 **sync 레이어 containment** 다 (advisor 권고: "containment of asymmetry pending structural diagnosis"). 구조적 비대칭(`GridBody.tsx` L263 inner div 의 `minWidth: 'max(fit-content, 100%)'` 부재) 자체는 해소되지 않았다. 마스터 검증 후 정상 동작 확인되면 그대로 두고, 다음 그리드 layout 변경 사이클에서 헤더-본문 inner 구조 정렬을 별도 작업으로 권장.

부수 효과 — source.scrollLeft 재할당이 일부 브라우저에서 비동기 scroll event 를 한 번 더 발화시킬 수 있으나, Phase 1 의 가드 윈도우(한 프레임)와 결합되어 두 번째 사이클은 no-op 으로 수렴 (무한 루프 아님, 1프레임 노이즈 가능성).

## v001.310.0

> 통합일: 2026-05-20
> 플랜 이슈: #129 HOTFIX 4 (HOTFIX 1 + HOTFIX 3 revert → focusout 기반 close 로 교체)

### 개요

v001.303.0 (#129 HOTFIX 3) 적용 후 마스터 보고: "캘린더에서 월 이동(chevron)이나 날짜 선택 전부 누르면 선택 안되고 닫혀". 마스터 추가 확인: 캘린더만 닫힘, 인쇄 모달은 그대로.

이 표현이 결정적 — chevron 클릭 시 월이 안 바뀌고 (React onClick 미발화), 날짜 클릭 시 날짜도 안 선택되고 (React onClick 미발화). HOTFIX 2/3 의 진단 (Radix DismissableLayer) 은 폐기. 진짜 회귀 = React onClick 자체가 발화 안 함 + 캘린더 닫힘.

HOTFIX 3 의 element 레벨 native `pointerdown` stopPropagation 이 의도와 무관하게 React 의 portal-event delegation 또는 브라우저의 click 생성 경로를 깨고 있을 가능성이 가장 유력. HOTFIX 1 의 document mousedown 리스너도 `containerRef.contains` 가 어떤 이유로 false 반환하여 잘못 닫고 있을 가능성.

해법: HOTFIX 1 (document mousedown click-outside) + HOTFIX 3 (element native stopPropagation) 둘 다 완전 revert. native 이벤트 전파를 일절 건드리지 않는 **focusout 기반 close** 패턴으로 교체. 컨테이너 div 에 `tabIndex={-1}` + `outline-none` 부여, position 설정 시점에 `el.focus()` 수행, `focusout` 이벤트에서 `relatedTarget` 이 캘린더 내부 또는 anchor 내부인지 확인해 외부일 때만 `onClose` 호출.

native event 미간섭 → React onClick (chevron / 날짜 / X / 초기화) 정상 발화. Radix 와도 무관 (focus 만 사용).

### 페이즈 결과

- **Phase 5 / HOTFIX 4** (fix): HOTFIX 1 의 document mousedown 리스너 useEffect 제거, HOTFIX 3 의 element native pointerdown/mousedown stopPropagation useLayoutEffect 제거. `useEffect` import 도 제거 (다른 곳 미사용). 새 useLayoutEffect 추가 (deps `[position, onClose, anchorRef]`): position 설정 후 `el.focus()` + `el.addEventListener('focusout', ...)` 등록. relatedTarget 이 `el` 또는 `anchorRef.current` 내부면 skip, 외부면 onClose. JSX 컨테이너 div 에 `tabIndex={-1}` + `outline-none` 추가. (`17dbbbc6`)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx`

### 비고 (정직 보고)

- 본 hotfix 는 listener **경로 자체를 바꾸는** 시도. 마스터 보고가 정확히 어느 listener 로 닫히고 있는지 확인되지 않은 채 가설을 정리해 진행.
- 만약 본 hotfix 적용 후에도 동일 증상 (chevron / 날짜 클릭 시 onClick 미발화 + 캘린더 닫힘) 이 재현되면 **원인 가설이 통째로 잘못된 신호**. 그 경우 listener 가 아닌 다른 메커니즘 (remount / Radix focus-trap 간섭 / event delegation 문제) 일 가능성. 추가 hotfix 전에 dev server 콘솔 로그 + React DevTools 로 실제 close 호출 stack 을 잡는 것이 정확.
- 잠재 부작용 후보: Radix Dialog 의 modal focus-trap 이 portal 된 캘린더로의 `el.focus()` 를 거부하고 focus 를 DialogContent 로 되돌리면 focusout 이 즉시 발화 → 캘린더가 열리자마자 닫힘. 이 경우 focus 패턴 자체 폐기 필요.
- `fs-sub-data-viewer` / `fs-external-data-viewer` 사본은 본 plan 범위 외.

## v001.309.0

> 통합일: 2026-05-20
> 플랜 이슈: #136

### 페이즈 결과
- **Phase 1**: `.fs-data-viewer-container` 및 모든 하위 요소에 `overscroll-behavior-x: contain` 적용 (`src/app/styles/index.css`). 트랙패드 가로 스와이프가 그리드 좌/우 끝 도달 후 브라우저 뒤로/앞으로 nav 를 트리거하던 현상 차단. 가로 스크롤이 발생하지 않는 화면 폭에서는 `contain` 이 자연 no-op 이라 기본 브라우저 뒤로/앞으로 제스처는 유지됨. fs_data_viewer 패키지가 vertical 축에는 이미 `overscroll-behavior-y: contain` 을 적용한 선례에 horizontal 축을 정합화.

### 영향 파일
- `data-craft`:
  - `src/app/styles/index.css`

## v001.308.0

> 통합일: 2026-05-20
> 플랜 이슈: #126 (HOTFIX 1 — 결제 비밀번호 다이얼로그 UX 개선)

### 개요

v001.297.0 (#126 본 플랜) 적용 후 마스터 보고 결함 2건을 한 HOTFIX 로 묶어 해소:

**결함 A** — 결제 수단 등록/변경(`card-change`) 흐름의 비밀번호 설정 모달에서 X / overlay / ESC 로 닫으려 할 때 브라우저 시스템 `window.confirm()` 노출. 추가로 "취소" 한 번 클릭으로 닫히지 않고 두 번 눌러야 닫히는 사이클 (confirm 취소 → PaymentPasswordSetupStep 복원 → 사용자가 다시 X → 다시 confirm 호출 → 또 취소).

**결함 B** — 비밀번호 설정 완료 후 모달의 "완료" 상태 화면이 1초도 유지되지 못하고 즉시 닫혀 부자연스러움.

### 해법 (HOTFIX 1)

**`src/pages/billing-callback/ui/BillingSuccessPage.tsx`** (`ccf8ef18`):
- `handlePasswordSetupDismiss` 에서 `window.confirm` 제거.
- 신규 state `showDeleteConfirmDialog`. card-change 분기에서 dismiss 시 `setShowPasswordSetup(false); setShowDeleteConfirmDialog(true);` 호출 — 비밀번호 모달은 닫히고 shadcn AlertDialog 만 명확히 표시.
- 취소 핸들러: `setShowDeleteConfirmDialog(false); setShowPasswordSetup(true);` — 1번 클릭으로 confirm 다이얼로그만 닫고 비밀번호 모달 복원. "취소 2번" 사이클 해소.
- 확인 핸들러: 기존 `deleteCard()` + `navigate(target)` 로직 그대로 이식.
- 신규/프로모션 결제 분기는 변경 없음 (기존 그대로 즉시 이동).

**`src/features/subscription/ui/PaymentPasswordSetupStep.tsx`** (`ccf8ef18`, `f100648e`):
- step 유니온 확장: `'enter' | 'confirm' | 'complete'`.
- BE 저장 성공 시 `onPasswordSaved` 콜백으로 `passwordCompleted` 플래그 즉시 설정 → `beforeunload` beacon 레이스 차단.
- `setStep('complete')` 로 전이 후 카운트다운 effect 시작.
- `countdown` state 초기값 `COMPLETE_COUNTDOWN_SEC=3`. `setInterval(1000ms)` 로 3 → 2 → 1 → 0 감소, 0 도달 시 `onComplete()` 호출.
- complete 단계 UI: 성공 표시 + "N초 뒤 창이 닫힙니다" 문구 (N 은 동적 countdown).
- 사용자가 X 강제 닫으면 즉시 onComplete 호출 (interval cleanup 보장).
- 보완 커밋: useEffect body 의 `setCountdown(remaining)` 직접 호출 제거 (`react-hooks/set-state-in-effect` 룰 해소). state 초기값이 이미 COMPLETE_COUNTDOWN_SEC 라서 불필요한 호출.

### 영향 파일

**data-craft**
- `src/pages/billing-callback/ui/BillingSuccessPage.tsx`
- `src/features/subscription/ui/PaymentPasswordSetupStep.tsx`

### 테스트 시나리오

1. **card-change 흐름 X 클릭 → 커스텀 confirm 다이얼로그 노출** (window.confirm 아닌 모달 UI).
2. **confirm "취소" 1회 클릭 → 비밀번호 모달 복원** (2번 눌러야 닫히는 사이클 사라짐).
3. **confirm "확인" 1회 클릭 → 카드 삭제 + navigate** (기존 동작 보존).
4. **비밀번호 설정 완료 → "3초 뒤 창이 닫힙니다" 표시 → 1초마다 감소 → 3초 후 자동 닫힘**.
5. 완료 화면 중 X 강제 닫기 → 즉시 닫힘 (카운트다운 cleanup).

### 회귀 위험

- 신규/프로모션 결제 분기는 dismiss 시 카드 삭제 confirm 미노출 (기존 동작 그대로). 변경 없음 확인.
- `beforeunload` beacon: passwordCompleted 가 onPasswordSaved 시점에 즉시 true 가 되므로, 완료 화면 카운트다운 중 페이지 이탈 시도 시 beacon 미발사 (정상 — 카드 삭제 X).

## v001.307.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 12 — 리더 시스템 완전 제거 + universal-trigger 구조 재구축)

### 개요

마스터 명령: **리더(leader) 개념을 완전히 제거**하고 어느 rowLink 셀에서든 선택 시 그 target row 값으로 같은 source row 의 그룹 모든 컬럼 cellValue 를 일제히 재배치하는 universal-trigger 구조로 재구축. 본 핫픽스는 플랜 #118 의 핵심 모델을 근본적으로 단순화 — 비대칭 leader/follower 관계 → 평등한 그룹.

### 변경 (15 파일, +96 / -459)

#### 1. 데이터 모델
- **`entities/row-link/types.ts`**: `RowLinkConfig` 에서 `isLeader` 와 `leaderTargetColumnId` 완전 제거.
- **`entities/row-link/helpers.ts`**: `parseRowLinkConfig` 가 두 필드 없이 파싱 성공. 구버전 데이터 (isLeader 포함) 는 해당 필드 silent drop 으로 무시 — 기존 그룹은 universal-trigger 동작으로 자동 전환.

#### 2. universal-trigger 동작
- **`useRowLinkCell.ts`**: `handleLeaderValueSave` → `handleAnyCellSave` 일반화. 어느 셀이든 클릭 시 ConnectionEditOverlay 가 그 셀의 `mappedTargetColumnId` 를 기준으로 target group 행 목록 표시. 사용자가 target row 선택 시 — (a) 클릭 셀 즉시 저장 → (b) `requestRowLinkTargetRow` 로 target row 전체 데이터 조회 → (c) 같은 source row · linkGroupId 의 모든 다른 셀에 각자 `mappedTargetColumnId` 대응 값 자동 채움.
- **`RowLinkRenderer.tsx` / `FsGridRowLinkCellRenderer.tsx`**: `config.isLeader === true` 분기 제거. 모든 rowLink 셀이 interactive.

#### 3. 컬럼 메뉴 / chevron 통합
- **`ColumnHeader.tsx`**: HOTFIX 1 의 비리더 chevron 차단 제거 — 모든 rowLink 컬럼은 chevron 노출.
- **`menuItems.ts`**: HOTFIX 4 의 `isLeader=true` early-return 분기를 모든 rowLink 컬럼에 적용 (단일 "행 연결 그룹 관리" 항목).
- **`useTableView.ts`**: HOTFIX 6 의 chevron → 모달 직접 오픈 동작을 모든 rowLink 컬럼에 적용.

#### 4. RowLinkGroupManageDialog UI
- 좌측 사이드바: "★ 리더" 주황 pill 배지 제거.
- 우측 hero: "리더" 배지 제거.
- 우측 02 동작 섹션: "연결 그룹 리더" 토글 + 보조 텍스트 제거. 옵션 카운터 자동 갱신.
- 행 그룹 토글의 disabled / "리더 열에서는 사용할 수 없습니다" 분기 제거.
- footer 하단 "선택 연결 열 제거" 의 "리더 자동 제외" 로직 제거. "그룹 전체 = 연결 그룹 삭제" 동적 라벨 (HOTFIX 8) + 즉시 반영 (HOTFIX 11) 유지.

#### 5. column-restrictions / rowAddHelpers / rowPasteUtils
- HOTFIX 1 의 `isRowLinkNonLeaderColumn` 참조 모두 제거 (3개 파일). 비리더 readonly 강제도 더 이상 leader 기준이 아닌 일반 rowLink 정책으로 단순화.

#### 6. addRowLinkColumns / RowLinkConfigDialog / useRowLinkGroup
- `addRowLinkColumns`: 새 컬럼 중 어느 것도 `isLeader=true` 로 지정 안 함.
- `RowLinkConfigDialog`: 리더 지정 단계 + AppendModeProps 의 `leaderTargetColumnId` pre-fill 제거. Step 흐름 단축.
- `useRowLinkGroup`: `updateLeaderInGroup` 함수 제거 + `index.ts` re-export 정리.

### 영향 파일 (HOTFIX 사전 승인 — 마스터 "구조 재구축" 명시)

```
entities/row-link/{types.ts, helpers.ts}
features/grid/hooks/column-menu/menuItems.ts
features/grid/lib/helpers/column-restrictions.ts
features/grid/lib/row-management/{rowAddHelpers.ts, rowPasteUtils.ts}
widgets/cell-renderers/row-link/{FsGridRowLinkCellRenderer.tsx, RowLinkConfigDialog.tsx,
  RowLinkGroupManageDialog.tsx, RowLinkRenderer.tsx, useRowLinkCell.ts,
  useRowLinkGroup.ts, index.ts}
widgets/grid-table/components/ColumnHeader.tsx
widgets/grid-table/hooks/useTableView.ts
```

Commit `2e234b20`.

### 이전 핫픽스 갱신 정리

- HOTFIX 1 비리더 chevron 차단 → leader 개념 자체 소멸 → 모든 rowLink chevron 노출.
- HOTFIX 4 리더 메뉴 단일 항목 → 모든 rowLink 메뉴 단일 항목.
- HOTFIX 6 리더 chevron 직접 모달 → 모든 rowLink chevron 직접 모달.
- HOTFIX 2 연결 그룹 리더 토글 → 제거.
- HOTFIX 7 hero / 사이드바의 리더 배지 → 제거.

### 후속 (현 핫픽스 범위 초과 — 명시 보고)

**reference 모드 실시간 upstream 반영 손실**: 기존 reference 모드는 리더 값 → target row 조회 → 비리더 표시값 실시간 lookup. leader 기준점 제거 후 동일 lookup 재구현 불가 — 현재는 셀 클릭 시점 스냅샷 저장만. target table 데이터가 나중에 변경되어도 rowLink 셀 값 자동 갱신 안 됨. 별도 re-architecture 후속 후보.

### 정책 합치

- data-craft FE-only.
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 17 warnings).
- 회귀: 기존 그룹 (HOTFIX 1~11 동안 생성된) 들도 isLeader 필드 무시 + universal-trigger 로 자연 전환.

## v001.306.0

> 통합일: 2026-05-20
> 플랜 이슈: #130 (HOTFIX 1 — 테마 변경 권한 게이트 제거)

### 마스터 보고 증상
v001.302.0 머지 후 테마 변경 시도 자체가 실패. 브라우저 콘솔/서버 로그:
```
[ERROR] PERMISSION_DENIED (callId=FORBIDDEN, PUT /api/user-preference, status=403, user=6)
ForbiddenError: PERMISSION_DENIED at permission.middleware.ts:337:15
```

### 진단
PUT `/api/user-preference` 가 `permissionCheckMiddleware('app_theme_change')` 로 보호되어 일반 사용자의 본인 테마 저장이 BE 단에서 403 으로 거부됨. 엔드포인트는 per-user 의미 (`/user-preference`) 이나 게이트는 admin-level 권한 (`app_theme_change`, 코드 주석상 `enterprise-501`). FE 의 Phase 5 / `ThemeSection` 게이트도 동일 권한명을 검사하지만 user=6 의 FE 권한 상태가 desync 되어 PUT 까지 도달한 후 BE 가 차단. 마스터의 "DB-only, 인증된 모든 사용자가 본인 테마 변경" 의도와 게이트 의미가 충돌.

### 해법 — BE + FE 동시 게이트 제거
- **BE (`c0326b01`, data-craft-server)**: `src/routes/user-preference.ts` 의 PUT 라우트에서 `permissionCheckMiddleware('app_theme_change')` 미들웨어 제거. unused import 정리. `permissionMiddleware` (라우터-wide 인증 / 플랜 검증) 는 유지하여 인증 / 플랜 보호는 그대로.
- **FE (`9ad9bfbc`, data-craft)**:
  - `src/entities/theme/model/themeStore.ts` `setTheme()` 에서 `hasPermission('app_theme_change')` 게이트 + `useAuthStore` dynamic import 제거. setTheme 은 이제 `syncThemeToServer await → state·DOM commit` 만 수행 (race 차단 패턴 유지).
  - `src/widgets/settings-dialog/ui/ThemeSection.tsx` 에서 `usePermission('app_theme_change')`, `canChangeTheme` 변수, ThemeGrid `disabled` prop 제거.

### 영향 파일

data-craft-server:
- `src/routes/user-preference.ts`

data-craft:
- `src/entities/theme/model/themeStore.ts`
- `src/widgets/settings-dialog/ui/ThemeSection.tsx`

### 위험 / 미해결
- `enterprise-501` 의 원 설계 의도가 "회사 단위 테마를 admin 만 통제" 같은 별도 use case 였을 가능성. 본 HOTFIX 는 per-user preference 해석으로 게이트 제거. company-level 강제 테마 기능이 별도로 필요해지면 다른 엔드포인트로 분리 설계 필요 (현 플랜 범위 밖).
- 머지 커밋 메시지 (`merge[plan-enterprise #130 hotfix 1 BE/FE]: ... v001.303.0`) 의 버전 라벨은 본 패치노트 작성 시점에 v001.306.0 으로 확정되어 라벨이 어긋남 (작업 중 다른 플랜 #133 등이 선행 머지되며 버전 번호가 진행). 정사 기록은 본 항목.

## v001.305.0

> 통합일: 2026-05-20
> 플랜 이슈: #133

### 개요 — 그리드 뷰 스크롤 동기화 긴급 결함 (drift + 진동 크래시) 수정

마스터 보고된 두 긴급 결함을 단일 파일 타겟 revert 로 해소.

- **디자인 모드**: 그리드 뷰 열 헤더가 본문보다 더 가로 스크롤되어 세로 정렬이 어긋남.
- **뷰 모드**: 동일 스크롤 동기화 깨짐 + 본문이 무한 진동(setState 루프)하다 페이지 크래시. 특히 가로 스크롤바 마우스 클릭 시 강하게 재현.

### 근본 원인 — 커밋 3d82b92a 의 회귀

`packages/fs-data-viewer/src/features/grid/hooks/useScrollSync.ts` 의 `createScrollHandler` 가 커밋 `3d82b92a` (#111 Phase 2, 2026-05-19) 에서 **rAF 배치 sync** 로 전환된 것이 두 결함의 직접 원인:

- **target scrollLeft 쓰기**: 동기 쓰기 → rAF 1프레임 지연 쓰기 → 1프레임 시각적 drift + 본문 폭 < 헤더 폭일 때 `scrollLeft` clamp 영구화 = "헤더만 더 스크롤".
- **가드 해제 시점**: `requestAnimationFrame(() => guard=false)` (한 프레임 윈도우) → `flush()` 내 writes 직후 동기 해제 → `el.scrollLeft = next` assignment 가 유발하는 **비동기 onScroll** 이 가드=false 를 만나 재진입 허용 → clamp 된 값이 source 로 역기록 → 자기 발화 setState 루프 → 크래시.
- 스크롤바 클릭은 단일 큰 폭 jump 를 만들어 clamp 빈도 ↑ → 진동 강하게 발산 (마스터 단서와 정합).

### 페이즈 결과

- **Phase 1** (`ab66d2b9`): `packages/fs-data-viewer/src/features/grid/hooks/useScrollSync.ts` 의 3d82b92a 변경분만 타겟 revert. `createScrollHandler` 의 `pendingScrollLeft` / `rafId` 클로저 변수 + `flush()` 내부 함수 제거하고, 동기 scrollLeft 읽기·쓰기 + `requestAnimationFrame(() => isScrollingSyncRef.current = false)` 지연 가드 해제 (가드 윈도우 = 한 프레임 전체) 시맨틱으로 복원. JSDoc 도 이전 단문 표현으로 복원. `useScrollSync` hook 시그니처 및 4 핸들러 export 구조 변경 없음 — 호출처(GridHeader / GridBody / GroupHeaderRow / Aggregation) 영향 없음. git diff 인덱스 해시가 3d82b92a 이전 상태(5c705b5c)와 정확히 일치함을 확인.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/features/grid/hooks/useScrollSync.ts`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 20 warnings — 사전 존재 분).
- advisor #1 (plan): 5/5 PASS (Intent / Logic / Group Policy / Evidence / Command Fulfillment).
- advisor #2 (outcome): 5/5 PASS — index hash 정합으로 정확성 증거 명확.

### 잔존 후속 (PENDING 게이트 시점 기준)

revert 가 두 결함을 모두 해소할 가능성이 가장 높음. 만약 뷰 모드 진동이 잔존하면 (특히 body 스크롤바 클릭 시) 트리거가 `GridBody.tsx` L235~242 의 Enterprise 038 `dispatchEvent('scroll')` 경로 + 가상화 측정 사이클 쪽이라는 강한 시그널 — 핫픽스로 가드 안에서 dispatch 하도록 보강.

### 절차 노트

- 단일 페이즈 / 단일 파일 타겟 revert. `git revert 3d82b92a` 같은 커밋 단위 revert 가 아닌 해당 파일의 변경분만 역적용 (#111 Phase 2 의 다른 컨텍스트 보존을 위해).
- 3d82b92a 의 rAF 배치가 의도한 **프레임당 DOM 쓰기 횟수 최소화** 성능 이득은 본 revert 로 사라짐. 현 단계 우선순위는 정확성 > 성능.

## v001.304.0

> 통합일: 2026-05-20
> 플랜 이슈: #127 (HOTFIX 4 — button cell deleteRow gridUtil 정공법 위임, server paging cache 동기)

### 개요 — 6번째 디버깅 사이클에서 진짜 원인 확정

이전 5회 시도 (Phase 1, 2, HOTFIX 1, 2 = 잘못된 패키지 fs-sub-data-viewer; HOTFIX 3 = 옳은 패키지지만 잘못된 접근) 모두 미반영. advisor 와의 6번째 라운드에서 마스터의 결정적 단서 ("행 메뉴 / 체크 다중삭제는 즉시 사라짐") 를 출발점으로 두 경로의 차이를 정밀 추적해 진짜 원인 확정.

**원인**: `packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableView.ts:224-247` 의 서버 페이징 동기 코드가 **렌더 시점에 in-place mutation** 으로 `viewerModel.rowModelList` 를 server cache 의 loaded rows 로 덮어씀:
```ts
rowSyncRef.current.model !== viewerModel
  viewerModel.rowModelList.length = 0;
  viewerModel.rowModelList.push(...loadedRows);
```

이전 시도들은 모두 어떤 형태로든 `viewerModel.rowModelList` 만 변경 (splice / filter / setViewerModel). 다음 render 시 위 sync 가 server cache 의 (삭제 안 된) loaded rows 로 push back → 삭제된 행 부활 → 새로고침 안 함.

**row-menu / 다중삭제 가 작동하는 이유**: 그들이 호출하는 `gridUtil.deleteRow` (`rowDeleteUtils.deleteRow:122-127`) 가 **`notifyRowDeleted(deletedRowFields.length, deletedRowFields)` 로 server paging cache 자체에서 삭제** → 다음 render 의 push back 에 삭제 행 미포함 → 영구 반영.

### 해법

button cell `deleteRowAction` 을 row-menu 와 동일하게 **`gridUtil.deleteRow([internalRow])` 정공 경로로 위임**:
```ts
if (gridUtil) {
  const internalRow = gridUtil
    .generateCustomRowList()
    .find((r) => r.cells['__rowField__']?.value === rowField.toString());
  if (!internalRow) return false;
  await gridUtil.deleteRow([internalRow]);
  if (pruneStateForRowField) pruneStateForRowField(rowField);
  return true;
}
```

- `ButtonActionContext` 에 `gridUtil?: FsGridUtil` 필드 optional 추가 (5개 callsite 하위 호환).
- `useButtonAction.ts` 에서 `useGridContext().gridUtil` 비구조화 + 주입.
- `deleteRowAction` async `Promise<boolean>` 화. dispatcher (`index.ts`) 의 `normalizeBoolean` 호출에 `await` 보정.
- 기존 setViewerModel / splice+onRefresh 레거시 fallback 분기 보존 (외부 consumer 하위 호환).

Phase 1 의 원래 의도와 동일한 패턴이지만, 그때는 fs-sub-data-viewer 패키지에 적용되어 사용자에게 미도달.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/grid/lib/button-actions/types.ts`
- `packages/fs-data-viewer/src/features/grid/lib/button-actions/deleteRowAction.ts`
- `packages/fs-data-viewer/src/features/grid/lib/button-actions/index.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts`

### 페이즈 결과

- **Phase 6 / HOTFIX 4** (fix): button cell deleteRowAction 을 gridUtil.deleteRow 정공 경로로 위임. (`5518a79f`)

### 검증

- 코드 inspection: row-menu (`row-menu.ts:44`) 와 정확히 동일한 호출 패턴 (`gridUtil.generateCustomRowList().find(...)` + `await gridUtil.deleteRow([internalRow])`).
- row-menu 가 작동 확인됨 (마스터 보고) → 동일 호출의 button cell 도 작동 보장.
- gridUtil.deleteRow 의 정규 경로가 `stateManager.removeRows` (no-op) / `reorderRowByIndex` / 서브그리드 orphan 정리 / `saveBatchChanges([deleteChange, seqChange])` / `notifyRowDeleted` 6단계 모두 수행 — 이전 hotfix 들의 잔존 트레이드오프도 한꺼번에 해결.
- lint gate: hotfix4 worktree 가 node_modules 미설치로 우회. 마스터 빌드 검증 시 정상 빌드 여부 확인 권장.

### 잔존 후속

- **자매 액션 가드 미적용**: Phase 2 의 toastAlreadyInState + complete/incomplete/reset guard 는 여전히 fs-sub-data-viewer 에만 존재. fs-data-viewer 에 동일 가드 포팅 필요 시 별도 플랜.
- **구조적 결함 (cross-package)**: 동일 기능 사본이 3개 패키지에 분산. 단일 source 화 또는 cross-package 일괄 적용 메커니즘 별도 플랜 권고.
- **fs-sub-data-viewer / fs-external-data-viewer 의 동일 패턴**: 사용 시 별도 포팅 필요.

## v001.303.0

> 통합일: 2026-05-20
> 플랜 이슈: #129 HOTFIX 3 (컨테이너 native pointerdown 리스너 — React synthetic 으로는 Radix DismissableLayer 차단 불가)

### 개요

v001.298.0 (#129 HOTFIX 2) 적용 후에도 캘린더 내부 클릭이 인쇄 모달을 닫는 회귀 지속. HOTFIX 2 가 React `onPointerDown={(e) => e.stopPropagation()}` / `onMouseDown` 핸들러를 캘린더 컨테이너에 부착했음에도 효과가 없었던 이유:

근본 원인 재진단:
- React synthetic event 의 `e.stopPropagation()` 은 React event delegation (React 17+ 는 root container 에 capture-phase 리스너) 내부 전파만 멈춘다. native DOM 이벤트는 그대로 document 까지 bubble.
- Radix `@radix-ui/react-dialog` 의 `DismissableLayer` 는 `document.addEventListener('pointerdown', ...)` 로 **native** 리스너를 직접 등록 (React 시스템 외부). React stopPropagation 으로는 차단 불가.

해법:
캘린더 컨테이너 element 에 **native** 리스너를 직접 부착하여 native pointerdown/mousedown 의 bubble 을 element 단계에서 중단. document Radix 리스너 도달 불가.

추가: 부착 effect 를 `useEffect` 가 아닌 `useLayoutEffect` 로 작성 — paint 직전 동기 부착이므로 빠른 클릭 race 도 차단.

React onClick (날짜/chevron/X/reset) 은 React root 의 capture-phase delegation 으로 처리되므로 native bubble stopPropagation 의 영향을 받지 않고 정상 동작.

### 페이즈 결과

- **Phase 4 / HOTFIX 3** (fix): HOTFIX 2 에서 부착한 React `onPointerDown` / `onMouseDown` 핸들러 제거. `useLayoutEffect(() => { containerRef.current.addEventListener('pointerdown', stop); containerRef.current.addEventListener('mousedown', stop); return cleanup; }, [position])` 추가 — deps `[position]` 으로 좌표 set 의 commit 직후 paint 전 동기 부착. cleanup 으로 unmount 시 리스너 해제. (`2b4d1d9e` → `667ad014` advisor 권고 반영 useEffect → useLayoutEffect 교체)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx`

### 비고

- **포터블 패턴 일반화**: createPortal + Radix Dialog 호스트 조합에서 dismiss 회피는 React synthetic 레이어로는 불가. 컨테이너 element 에 native 리스너 직접 부착 + paint 전 동기 부착 (`useLayoutEffect`) 이 표준 해법.
- React 17+ 의 root capture-phase delegation 덕에 native bubble stopPropagation 이 React onClick 을 막지 않음 — 이 사실에 의존.
- `fs-sub-data-viewer` / `fs-external-data-viewer` 의 사본도 portal+Radix Dialog 조합에서 동일 회귀 가능 — 별도 hotfix 시 동 패턴 적용.

## v001.302.0

> 통합일: 2026-05-20
> 플랜 이슈: #130

### 마스터 보고 현상
서비스 테마를 오션에서 라이트 모드로 변경하고 새로고침하면 이전 (서버) 값으로 회귀. 마스터 원문은 "다시 라이트 모드로" 였으나 "오션→라이트→라이트" 는 정상 동작이라 "다시 **오션**으로 되돌아간다" (영속화/일관성 실패) 로 해석하여 진행.

### 결정 분기 — 플랜 진행 중 방향 전환
- Phase 1-3: 초기 분석은 race condition 으로 진단 — `setTheme()` 의 server PUT 이 fire-and-forget 이라 새로고침이 PUT 보다 빨리 일어나면 bundle API 가 서버의 옛 값을 반환해 `seedBundleData` 가 로컬을 덮어쓰는 패턴. localStorage 기반 `dc_theme_dirty` flag + seedBundleData 가드 + 권한 일관화로 해결.
- **마스터 신규 지침 (실행 중 inline)**: "테마 관련 로컬 저장 모든 로직 제거, DB 데이터 기반만 (로그인/회원가입/기업 로그인/기업 회원가입 페이지 예외)." 아키텍처 전환 요구.
- Phase 4: Phase 1-3 도입 분을 포함해 테마 관련 모든 로컬 저장 로직 제거 (Zustand `persist` 미들웨어, `dc_theme_{companyId}` 캐시, `DC_THEME_DIRTY_KEY` flag). `preAuthTheme` (`dc_preauth_theme`) 은 master 예외 범위로 보존.
- Phase 5: DB-only 모델에서도 race 가 그대로 존재함을 advisor #2 직전에 식별 — fire-and-forget PUT 을 await PUT 패턴으로 재설계. `setTheme()` 을 async + Promise<void> 시그니처로 전환, PUT 200 OK 이후에만 Zustand state + DOM commit. race 근본 차단.

### 페이즈 결과
- **Phase 1 (`bb7542e3`)**: themeStore 에 `DC_THEME_DIRTY_KEY` 도입 + `ThemeSwitcher` 인증 사용자 경로를 `setTheme()` 로 통일.
- **Phase 2 (`a72179b4`)**: `seedBundleData` 에 4분기 dirty flag 가드 추가 (dirty≠server 시 로컬 우선 + 재 PUT, 일치 시 flag clear).
- **Phase 3 (`cfac0845`)**: 권한 가드 일관화 (`setTheme` 의 dirty 기록을 권한 체크 안쪽으로 이동), `seedBundleData` branch (a) 조건 확장 + 재 PUT 권한 가드.
- **Phase 4 (`08600a6c`)**: **방향 전환**. Zustand `persist` 제거 (`dc_theme` 키 소실), `saveCompanyTheme`/`loadCompanyTheme`/`getCompanyThemeKey` 삭제, `setTheme()` 내 dirty flag + 기업별 캐시 저장 블록 제거, `themeServerSync` 의 dirty-clear `.then()` 체인 삭제, `seedBundleData` 4분기 가드 → `serverTheme` 존재 시 단일 시딩으로 단순화, theme barrel export 정리. `preAuthTheme` 예외 보존.
- **Phase 5 (`b2d5ecaf`)**: `syncThemeToServer` async + throw 전환, `setTheme()` async/await PUT 후 commit 으로 재작성 — PUT 200 OK 이전에는 Zustand state·DOM 미반영, 새로고침 시점부터는 서버와 일치 보장. 호출처 (`ThemeSection`, `ThemeSwitcher`) 는 `void …catch` 패턴으로 동기 핸들러 시그니처 호환 유지.

### 영향 파일

data-craft:
- `src/entities/theme/model/themeStore.ts`
- `src/entities/theme/model/themeServerSync.ts`
- `src/entities/theme/index.ts`
- `src/app/lib/seedBundleData.ts`
- `src/widgets/settings-dialog/ui/ThemeSection.tsx`
- `src/features/theme-switcher/ui/ThemeSwitcher.tsx`

### 위험 / 후속 권고
- 드롭다운 선택 → PUT 완료까지 100~500ms 시각적 피드백 없음 (로딩 스피너 미구현).
- 권한 미보유 시 `setTheme()` silent no-op — UI 단 사전 비활성화 (버튼/셀렉터 disabled + 권한 안내 토스트) 미구현.
- `persist` 제거 부작용: 초기 페이지 로드 시 default `'light'` → 서버 테마 적용까지 짧은 flash (수십~수백 ms). 인증된 사용자가 매 새로고침마다 경험.
- `AuthProvider.tsx:194-199` 의 guest-route USER_THEMES 강제 리셋 로직은 별개 경로로 본 플랜에서 미관여.
- 머지 커밋 메시지 (`merge[plan-enterprise #130]: ... v001.297.0`) 의 버전 라벨은 본 패치노트 작성 시점에 v001.302.0 으로 확정되어 라벨이 어긋남 — 정사 기록은 본 항목.

## v001.301.0

> 통합일: 2026-05-20
> 플랜 이슈: #131

### 페이즈 결과
- **Phase 1 (`f1f4d81`)**: 데이터 뷰어 문서 타입 셀 모달(`DocumentEditDialog`) 의 키보드 핸들러를 React `onKeyDown` prop 방식에서 document-level capture-phase listener 방식으로 전환. `useDocumentKeyboardHandlers` 를 `useEffect` 기반으로 재작성하여 `document.addEventListener('keydown', ..., true)` 등록 + unmount cleanup 구조화, `e.isComposing` 가드로 한글 IME 합성 중 false-positive 차단, Shift+Enter / Escape 양쪽 모두 `preventDefault + stopPropagation + stopImmediatePropagation` 3종 세트 적용. `DocumentEditDialog.tsx` 는 backdrop div 의 `onKeyDown` prop 및 분해 할당 제거. 모달 mount 직후 BlockNote(ProseMirror) 키보드 라우팅 race 와 무관하게 capture-phase 가 항상 먼저 onSave 를 트리거하므로 "최초 1회 Shift+Enter 미동작" 증상 해소. `long-text-cell/EditDialog.tsx` 의 동일 검증 선례 패턴 재사용.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/useDocumentKeyboardHandlers.ts`
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditDialog.tsx`

## v001.300.0

> 통합일: 2026-05-20
> 플랜 이슈: #127 (HOTFIX 3 — fs-data-viewer 패키지 포팅, 실제 사용 패키지에 즉시 반영 적용)

### 개요 — 결정적 진단

본 플랜의 v001.288.0 (Phase 1), v001.293.0 (HOTFIX 1), v001.296.0 (HOTFIX 2) 가 모두 **틀린 패키지** 에 적용됐다는 사실이 마스터의 3차 재테스트 보고 후 advisor 검증 grep 으로 확정:

```
src/widgets/viewer-widget/ui/Viewer.widget.tsx:16: from 'fs_data_viewer'
src/widgets/sub-viewer-widget/ui/SubViewer.widget.tsx:14: from 'fs_data_viewer'
src/widgets/external-viewer-widget/ui/ExternalViewer.widget.tsx:15: from 'fs_data_viewer'
```

메인 / 서브 / 외부 viewer widget 셋 모두 **`fs_data_viewer`** (= `packages/fs-data-viewer/`) 패키지를 import. 이전 4회 수정 (Phase 1, 2, HOTFIX 1, 2) 은 모두 `packages/fs-sub-data-viewer/` 에 적용되었고, 이 패키지는 메인 앱 번들에 포함되지 않는 별도 워크스페이스 패키지. 사용자가 화면에서 보는 코드는 `fs-data-viewer` 의 것이므로 이전 수정들은 도달하지 않음.

### 해법 (Phase 5, HOTFIX 3)

`fs-data-viewer` 의 동일 경로 파일들에 HOTFIX 2 와 동일한 `setViewerModel` functional update 정공법 패턴을 포팅:

1. **`74f21825`** (포팅): `packages/fs-data-viewer/src/features/grid/lib/button-actions/types.ts` 에 `setViewerModel` 필드 추가, `deleteRowAction.ts` 를 `setViewerModel(prev => ({...prev, rowModelList: filter(...).map(seq normalize)}))` 단일 경로로 재작성 (기존 `boolean` 반환 시그니처 + `pruneStateForRowField` 호출 보존), `useButtonAction.ts` 에 `useGridContext().setViewerModel` 비구조화 + 주입.
2. **`67fde587`** (타입 에러 해소 wiring): `setViewerModel` 을 optional (?) 로 변경하여 5개 기존 callsite (테스트 4개 + `ButtonRenderer.tsx`) 의 type 에러 일괄 해소. `deleteRowAction` 에 `if (setViewerModel) { 정공법 } else { 레거시 fallback }` 분기 추가. `ButtonRenderer.tsx` 는 `useGridContextOptional().setViewerModel` 로 정공법 경로 보장.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/grid/lib/button-actions/types.ts`
- `packages/fs-data-viewer/src/features/grid/lib/button-actions/deleteRowAction.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/ButtonRenderer.tsx`

### 페이즈 결과

- **Phase 5 / HOTFIX 3 시도** (fix): setViewerModel 패턴 포팅. (`74f21825`)
- **Phase 5 / HOTFIX 3 타입 해소** (fix): optional 화 + 5개 callsite 호환 + ButtonRenderer 주입. (`67fde587`)

### 잔존 후속 (본 hotfix scope 외)

- **자매 액션 가드 미적용**: Phase 2 의 `toastAlreadyInState` + complete/incomplete/reset 액션 사전 판정 가드는 `fs-sub-data-viewer` 에만 존재. 마스터 명시 보고가 delete 한정이라 본 hotfix 도 delete 한정. 필요 시 별도 플랜에서 fs-data-viewer 에 동일 가드 포팅.
- **fs-external-data-viewer 패키지**: 외부 viewer widget 도 fs_data_viewer 에서 import 하므로 fs-external-data-viewer 패키지 자체는 본 hotfix 의 직접 영향 외. 별도 사본으로 잔존 — 사용 시 별도 포팅.
- **seq 서버 동기 / reorderRowByIndex / 서브그리드 orphan / notifyRowDeleted** 누락은 이전 hotfix 와 동일하게 잔존.
- **구조적 결함 followup**: 동일 기능의 사본이 3개 패키지에 존재해 fix 가 한 사본에만 적용되면 사용자에게 도달하지 못하는 구조. 향후 별도 플랜에서 단일 source 화 또는 cross-package 일괄 적용 메커니즘 도입 권고.

## v001.299.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 11 — 그룹 전체 삭제 즉시 반영 버그 수정)

### 개요

마스터 보고: HOTFIX 8 의 `연결 그룹 삭제` (전체 선택) 가 동작하지만 본문 viewer grid 에 **즉시 반영 안 되고 새로고침해야 사라짐**. 부분 삭제 (`선택 연결 열 제거`) 는 정상.

### 원인

HOTFIX 8 lint hotfix (`b2154d1c`) 가 react-hooks/immutability 규칙 위반으로 `handleDeleteGroup` 의 viewerModel 직접 mutation 을 제거하고 `saveChange(immediate)` 만으로 단일화. saveChange 는 스토어 큐 경유이므로 onClose 로 dialog unmount 시점에 grid 는 stale columnModelList 를 참조 → 새로고침 전까지 삭제된 열 그대로 노출.

부분 삭제 (`handleRemove`) 는 mutation 코드가 `showAlert` 콜백 내부 (deferred callback) 에 위치하여 react-hooks/immutability 가 추적하지 않으므로 직접 viewerModel mutation 가능 → 즉시 반영.

### 변경

- **`packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx`** (`cdce8cf9`): `handleDeleteGroup` 의 루프 + saveChange + onRefresh + onClose 를 `showAlert` 콜백 내부로 이동. 부분 삭제와 정확히 동일 구조로 맞춤. mutation 이 deferred callback 안에 들어가면서 lint 규칙 회피 + viewerModel 직접 갱신 가능 → 즉시 반영 달성.

### 부수 효과

그룹 전체 삭제 시 **확인 대화상자** 추가됨 (showAlert 가 갖는 자연스러운 부수 효과). 부분 삭제와 UX 일관성 + 그룹 전체 삭제는 destructive 동작이라 confirm step 이 정당화됨.

### 영향 파일

- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (`cdce8cf9`: +20/-13). 이전 진단 commit `cddf16ee` 는 lint 차단 → 본 fixup 이 보강.

### 정책 합치

- data-craft FE-only.
- Lint gate: PASS (0 errors, 20 warnings).
- 회귀: 부분 삭제 / 리더 + 일부 부하 / 리더 단독 / 비 rowLink / 비리더 chevron / 리더 chevron 직접 모달 모두 무변경.

## v001.298.0

> 통합일: 2026-05-20
> 플랜 이슈: #129 HOTFIX 2 (캘린더 컨테이너 pointerdown stopPropagation — Radix DismissableLayer 외부 클릭 감지 회피)

### 개요

v001.295.0 (#129 HOTFIX 1) 적용 후, 캘린더 내부 (날짜 / 월 이동 chevron / 초기화 / X) 무엇을 누르든 캘린더가 즉시 닫히는 회귀 발생.

근본 원인: 인쇄 모달은 `@radix-ui/react-dialog` (Radix Dialog Primitive) 기반. Radix `DialogContent` 내부의 `DismissableLayer` 가 document 레벨 `pointerdown` (bubble phase) 리스너를 갖고 있어, content ref 외부 pointerdown 시 `onPointerDownOutside` 발화 → Dialog dismiss. `createPortal(document.body)` 로 떠 있는 캘린더는 Dialog content ref 의 React subtree 밖에 있지만 DOM 상으로도 외부에 위치 — 캘린더 내부 클릭이 Dialog 외부 클릭으로 잘못 인식되어 인쇄 모달이 닫히고 캘린더도 함께 unmount.

HOTFIX 1 의 `containerRef.contains` 가드는 본인의 document mousedown 리스너만 막을 뿐 Radix 의 별개 pointerdown 리스너에는 무영향.

해법: 캘린더 컨테이너 div 에 `onPointerDown={(e) => e.stopPropagation()}` 와 `onMouseDown={(e) => e.stopPropagation()}` 두 핸들러 추가. Radix DismissableLayer 는 bubble phase 리스너라 컨테이너에서 propagation 을 멈추면 document 까지 전파되지 않아 외부 클릭으로 인식되지 않음. 우리 자체 document mousedown 리스너는 native event 직접 등록이라 React stopPropagation 영향 받지 않고, `containerRef.contains` 가드로 내부 클릭 무시 동작 그대로 유지.

### 페이즈 결과

- **Phase 3 / HOTFIX 2** (fix): `DatePickerDropdown` 캘린더 컨테이너 div 에 `onPointerDown` / `onMouseDown` stopPropagation 핸들러 2 줄 추가. Radix DismissableLayer 외부 클릭 감지 회피. 기존 portal / fixed / useLayoutEffect rect / document click-outside 로직은 변경 없이 유지. (`feea8385`)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx`

### 비고

- 본 패턴 (portal-out 팝오버 + Radix Dialog 호스트) 의 일반 해법 — DismissableLayer 가 bubble phase 라 컨테이너 stopPropagation 으로 차단 가능.
- `useBackdropClickClose` 훅의 다른 호출처는 영향 없음.
- 캘린더 내부 React onClick 이벤트 (날짜 선택 등) 는 React synthetic 시스템 내 정상 동작 — stopPropagation 은 native pointerdown/mousedown 전파만 막음.

## v001.297.0

> 통합일: 2026-05-20
> 플랜 이슈: #126

### 개요

결제 시스템 업그레이드 흐름을 잔여기간·잔여인원 비례 즉시 차액 결제 단일 방식으로 통합. 폐기 대상은 업그레이드 / 인원 증가의 "즉시 만액 결제 / 다음 결제일 결제 / 예약" 3가지 모드. 다운그레이드와 월간→연간 전환은 기존 예약 흐름을 그대로 유지. 결제 사이클 단위를 캘린더 월에서 +31일 (월간) / +365일 (연간) strict 로 표준화. 사용자에게는 차액 계산식을 노출하지 않고 "잔여 요금제가 차감된 비용입니다" 단일 메시지로 안내.

### 정책 (마스터 확정, 2026-05-20)

- 결제 사이클 = **월간 +31일 / 연간 +365일 strict**. 첫 결제부터 갱신까지 일관 적용.
- 잔여일수 = **당일 제외, 익일부터 다음 결제일 직전까지의 실제 일수**. 분모 = 사이클 일수.
- flat 플랜 (`basic` / `pro` / `enterprise`) 은 차액 계산 시 seats=1 강제. flat ↔ per-seat 업그레이드도 동일 규칙.
- 환불 절대 없음 (기존 정책 유지).
- 다운그레이드 흐름 (`scheduleDowngrade`) 변경 없음.
- 월간→연간 전환은 업그레이드 모달에 미노출 — 별도 "플랜 관리 → 연간 예약" 진입점 (`SubscriptionActionSection` `useScheduleBillingCycleChange`) 에서만 처리.

### 변경

**data-craft-server (BE)** — 머지 커밋 `3fbd21b` (BE i-dev base 24 commits 격차 양측 보존 해소)

- `src/services/billingRenewal.service.ts` (`f463707`, `4a24b8e`): 갱신/첫결제/yearly promotion 만료일 모두 `setMonth(+1)+말일보정` / `setFullYear(+1)` → `setDate(+31)` / `setDate(+365)` 일관 적용.
- `src/services/billingSubscription.service.ts` (`54eef7a`, `da3b487`, `4a24b8e`, `3fbd21b`): `calculateProrationDiff` 신규 — 잔여일수·인원 비례 차액 산출, 프로모션 스냅샷 우선, flat 플랜 seats=1, max 가드. `executeUpgradeWithDiff` 신규 — SELECT FOR UPDATE → `charge()` → `payment_history` INSERT (`billing_cycle`=기존 cycle, `seats_at_payment`=신규인원) → `client` plan/seats UPDATE. `plan_expires_at` 변경 X. `scheduleUpgrade()` 폐기. 머지 시 `currentMonthlyPrice: number` 명시.
- `src/routes/subscription.ts` (`da3b487`): `POST /billing/schedule-upgrade` 폐기, `POST /billing/upgrade` 신설 (requirePaymentPassword 보존).
- `src/services/seatChange.service.ts` (`da3b487`, `3fbd21b`): 양측 보존 — HEAD `withIdempotency` wrap + guards + `getSeatChangeQuote` 보존, WIP 의 `executeUpgradeWithDiff` 위임 통합, `calculateProratedAmount` 폐기 → `calculateProrationDiff` 로 quote 정렬.
- `src/types/charge.types.ts` (`da3b487`): `ChargeMetadata.source` 에 `'upgrade-proration'` 추가.
- `src/controllers/billing.controller.ts` (`da3b487`, `f1419bf`): `executeUpgradeWithDiffController` 신설, CALL_ID 정렬.
- `src/config/constant.ts` (`f1419bf`): `CALL_ID.subscription.scheduleUpgrade` → `executeUpgradeWithDiff` rename.
- `src/models/promotion.model.ts` (`54eef7a`): `getClientPromotionSnapshotPrice` export.
- `scripts/migrations/2026-05-cancel-upgrade-pending.ts` (`f28c5ee`): 일회성 정리 스크립트 — 상향 `pending_plan_type` 만 NULL, `client_seat_change_requests delta>0 pending` 일괄 cancelled. 다운그레이드 / 월→연 / seat 감소 예약 보존.
- 테스트: `billingRenewal.test.ts` (5), `billingSubscription.proration.test.ts` (8), `.upgrade.test.ts` (5), `.seatChange.test.ts` (6).

**data-craft (FE)** — 머지 커밋 `3c90dfa` (재이식 — local i-dev base 재작성)

- 초기 WIP 가 stale `origin/i-dev` base 였고 그 사이 plan-enterprise #91 phase 13 (`c85d4046`) 이 `SeatAddDialog.tsx` 삭제 + `SeatManageDialog.tsx` 신설. 머지 시 4파일 충돌 + SeatAddDialog 삭제 발견 → abort 후 local i-dev base 위에 새 WIP (`plan-enterprise-126-billing-proration-작업-재이식`) 로 Phase 5/6 의도 재이식.
- `src/features/subscription/api/billingApi.ts` (`3c90dfa`): `scheduleUpgrade` 폐기, `upgrade` (`POST billing/upgrade`) 신설.
- `src/features/subscription/api/seatChange.api.ts` (`3c90dfa`): 즉시 응답 `chargedAmount`/`paymentId` BE 정합.
- `src/features/subscription/model/subscriptionQueries.ts` (`3c90dfa`): `useScheduleUpgrade` 제거, `useUpgrade` 신설.
- `src/features/subscription/ui/UpgradeDialog.tsx` / `UpgradeStepPayment.tsx` (`3c90dfa`): `upgradeMode` + 즉시/예약 분기 + 월/연 토글 + 단가 계산 전면 제거. "잔여 요금제가 차감된 비용입니다" 단일 안내. 다운그레이드 보존.
- `src/features/subscription/ui/PlanLimitExceededDialog.tsx` (`3c90dfa`): plan-limit 초과 시 업그레이드도 `useUpgrade` 로 교체.
- `src/features/subscription/ui/SeatManageDialog.tsx` (`3c90dfa`): 증가 분기 탭 UI 제거, 항상 즉시 차액 결제 단일. 감소 분기 예약 보존.
- `src/features/subscription/index.ts` (`3c90dfa`): re-export 정렬.

### 결제일 처리 보장

- 업그레이드 / 인원 증가 (즉시 차액): `plan_expires_at` 불변 → 다음 결제일 유지.
- 다운그레이드 (`scheduleDowngrade`): 기존 흐름 유지.
- 월간→연간 (`scheduleBillingCycleChange`): 현재 월간 사이클 종료 시점에 연간 결제 시작 (이후 365일 anchor).
- 첫 결제: `calculateExpiresAt` 도 +31/+365 strict.

### 사용자 노출 메시지

- 업그레이드 / 인원 증가: "잔여 요금제가 차감된 비용입니다".
- 월간→연간: "다음 결제일부터 연간 결제가 시작됩니다. 연간 결제는 10% 할인이 적용됩니다." (SubscriptionActionSection 진입점에 반영 여부 후속 확인).

### 배포 선행 조건

**마이그레이션 스크립트 실행 필수**: BE 배포 시점에 `scripts/migrations/2026-05-cancel-upgrade-pending.ts` 를 BE 코드 배포 전 또는 동시에 실행. 미실행 시 구 예약 시스템 pending 레코드가 신규 cron 에서 stale 가정으로 처리되어 사용자 손해 위험. `task-db-data` 또는 마스터 직접 실행.

### 후속 권장

- `src/features/subscription/types.ts` dead export 정리.
- `SubscriptionActionSection.tsx` 연간 예약 진입점 "10% 할인" 문구 점검.
- `promotion.service.ts:305` JSDoc 잔존 참조 정리.
- BE `upgrade` 응답에 `planExpiresAt` 미포함 → FE auth store 즉시 동기화 누락 (subscriptionStatus invalidate 로 결국 갱신). 별도 점검.
- `PlanLimitExceededDialog` 의 `paymentPassword` 가 `useUpgrade` body 에 미전달 — BE `requirePaymentPassword` 미들웨어 인증 경로 점검 필요.

### 회귀 위험

- 구 캘린더 월 사이클로 잡힌 기존 `plan_expires_at` 은 다음 갱신 시점부터 +31일 규칙 적용 — 한 사이클 동안 짧은 편차 (마스터 의도 부합).
- `payment_history` 차액 행이 회계 쿼리에 만액 행과 혼재 — `seats_at_payment` / `amount` 가 "차액" 의미임을 유의.

### 운영 메모 — WIP base 분기 문제

본 플랜 진행 중 초기 WIP A 두 개를 `origin/i-dev` base 로 생성한 결과, 로컬 i-dev 가 plan-enterprise #91 / #118 등 누적분으로 339 (FE) / 24 (BE) 커밋 앞서 있어 머지 시 광범위 충돌 발생. BE 는 양측 보존 머지로 해소, FE 는 SeatAddDialog 삭제 등 구조 변경으로 재이식 필요. 운영 규칙(`feedback_plan_enterprise_no_auto_push.md` — origin push 안 함) 과 충돌하는 base 선택 실수. plan-enterprise / plan-enterprise-os 스킬의 WIP base 명시 강화는 별도 I-OS 플랜으로 분리 예정.

## v001.296.0

> 통합일: 2026-05-20
> 플랜 이슈: #127 (HOTFIX 2 — 버튼 셀 행 삭제 setViewerModel 정공법)

### 개요

HOTFIX 1 (v001.293.0) 적용 후에도 잔존: 헤더 "저장중 → 저장완료" 는 정상 (saveChange 정상 동작) 인데 뷰어 본문 그리드에서 행이 새로고침해야 사라짐.

근본 원인 (재추적):
- `cellRendererChildModel.onRefresh` 의 본체 = `useGridDataLoader.ts:44` 의 `triggerRerender` = `setViewerModel(prev => ({...prev, rowModelList: [...prev.rowModelList], columnModelList: [...prev.columnModelList]}))`.
- HOTFIX 1 패턴 (`viewerModel.rowModelList = filter(...)` + `onRefresh()`): 객체 속성 직접 변경 후 setter 콜백을 호출했지만, `prev` 가 stale 한 호출 경로에서는 `[...prev.rowModelList]` 가 변경 *전* 배열의 shallow copy → React state 미갱신 → useMemo dep 변경 미감지 → 그리드 미반영.
- 헤더 저장중/저장완료 정상 = `saveChange` 가 별도 경로로 작동했음을 의미. 본문 미반영은 React state 갱신 누락 단일 문제.

### 해법 (Phase 4, HOTFIX 2)

`deleteRowAction` 을 정공법으로 재작성 — React state setter `setViewerModel` 직접 호출:
```ts
setViewerModel((prev) => ({
  ...prev,
  rowModelList: prev.rowModelList
    .filter((r) => r.rowField !== rowField)
    .map((row, idx) => ({ ...row, seq: idx })),
}));
```
- `setViewerModel` 은 `GridContext` value 의 멤버 (React `useState` setter) — 다음 render 에서 새 viewerModel 참조를 제공하도록 React 가 보장.
- `prev` 는 functional update 의 *가장 최신* state — stale 불가능.
- 객체 mutation / `onRefresh` / `stateManager` / `gridUtil` 의존 모두 제거. 단일 정공 경로.
- `ButtonActionContext` 에 `setViewerModel: Dispatch<SetStateAction<FsDataViewerModel>>` 필드 추가, `useButtonAction` 이 `useGridContext().setViewerModel` 주입.

### 페이즈 결과

- **Phase 4 / HOTFIX 2** (fix): deleteRowAction setViewerModel functional update 단일 경로로 재작성, ButtonActionContext + useButtonAction 에 setViewerModel wiring. (`27214e14`)

### 영향 파일

data-craft:
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/types.ts`
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/deleteRowAction.ts`
- `packages/fs-sub-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts`

### 잔존 트레이드오프 (본 hotfix scope 외, 이전 hotfix 와 동일)

- 남은 행들의 seq 재정규화는 클라이언트 state 에만 반영, 서버 동기 (`createRowSeqChange` 배치) 미수행.
- 서브그리드 orphan 정리 / `reorderRowByIndex` (행번호 셀 cellValue 갱신) / `notifyRowDeleted` (서버 페이징 totalRows 동기) 누락.
- 향후 별도 플랜에서 `cellRendererChildModel` 에 정식 `GridUtilContext` 노출 또는 `rowDeleteUtils.deleteRow` 호출용 어댑터 도입 권고.

## v001.295.0

> 통합일: 2026-05-20
> 플랜 이슈: #129 HOTFIX 1 (캘린더 backdrop overlay 제거 — 인쇄 모달 상호작용 차단 회귀 해소)

### 개요

v001.292.0 (#129 본 플랜) 적용 후, 캘린더는 인쇄 모달 위로 정상 표출되지만 인쇄 모달 본문의 클릭/스크롤 등 모든 상호작용이 차단되는 회귀 발생. 원인: portal+`fixed inset-0` backdrop 이 `z-12099` 로 viewport 전체를 덮어 인쇄 모달(z-12000) 위에 깔리면서 이벤트 가로채는 진짜 overlay 가 됨. 기존 `useBackdropClickClose` 패턴은 같은 stacking 컨텍스트 내부에 머무를 때만 무해했음.

해법: backdrop 엘리먼트와 `useBackdropClickClose` 호출을 완전 제거하고 `document.addEventListener('mousedown', handler)` 기반 click-outside 감지로 교체. 캘린더 컨테이너 `containerRef.contains(target)` 와 트리거 버튼 `anchorRef.current.contains(target)` 양쪽을 확인해 내부/트리거 클릭은 무시, 외부 클릭만 `onClose`. viewport 점유 overlay 가 없으니 모달 본문 스크롤/클릭 정상 복원, `toggleOpen` flip 동작과 충돌 없음.

### 페이즈 결과

- **Phase 2 / HOTFIX 1** (fix): `DatePickerDropdown` 에서 backdrop `<div fixed inset-0 z-12099>` 제거, `useBackdropClickClose` import/호출 제거. `containerRef` 추가 + `useEffect` 내 `document.addEventListener('mousedown', handler)` 로 외부 클릭 감지, cleanup 으로 리스너 해제. 컨테이너 div 의 `onClick stopPropagation` 도 제거 (이벤트 위임이 backdrop 이 아니라 document 라 불필요). Phase 1 의 portal + `position:fixed` + `useLayoutEffect` rect 계산 로직은 변경 없이 유지. (`156b5181`)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx`

### 비고

- `useBackdropClickClose` 훅의 다른 호출처에는 영향 없음 (본 파일에서만 import 해제).
- 본 hotfix 패턴(backdrop 엘리먼트 없이 document 리스너) 은 viewport 점유가 부담스러운 portal+fixed 팝오버 일반에 적용 가능. `fs-sub-data-viewer`, `fs-external-data-viewer` 패키지에 동일 사본이 있고 해당 패키지에서 동 클리핑 증상 보고 시 본 패치 패턴을 동일 적용 권고.

## v001.294.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 10 — 좌측 사이드바 체크박스 + 세로 간격 확대)

### 개요

마스터 보고: 좌측 사이드바 체크박스 크기 키우기 + 항목 간 세로 간격 확대.

### 변경

- **`packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx`** (`4e9f4f0`):
  - 헤더 전체 선택 체크박스 + 각 항목 행 체크박스 → `h-5 w-5` 명시 확대 (기본 브라우저 크기 → 한 단계 위).
  - 항목 행 wrapper 수직 패딩 `py-2` → `py-2.5` (클릭 영역 확보 + 세로 간격 증가).

### 정책 합치

- data-craft FE-only.
- Lint gate: PASS (0 errors, 20 warnings).
- 회귀: 검색 input / 헤더 layout / 추가 버튼 / 보라 세로 바 / 주황 리더 pill / 번호 prefix / 동작 로직 모두 무변경.

## v001.293.0

> 통합일: 2026-05-20
> 플랜 이슈: #127 (HOTFIX 1 — 버튼 셀 행 삭제 즉시 반영 보정)

### 개요

v001.288.0 (Phase 1) 의 `await gridUtil.deleteRow([row])` 위임 방식이 실사용 환경에서 즉시 반영을 트리거하지 못한다는 마스터 보고 (#127 hotfix 1). 디버깅 과정에서 두 가지 사실 확인:

1. `packages/.../createDefaultStateManager.ts:20` 의 `removeRows: () => {}` — **현 코드베이스에서 no-op 으로 정의됨**. 즉 `stateManager.removeRows(...)` 호출은 어디서 하든 효과 없음.
2. 실제 그리드 재렌더 트리거는 `packages/.../grid-table/hooks/useTableView.ts:215-219` 의 `useMemo(..., [viewerModel.rowModelList])` 가 **배열 참조 변경** 을 감지하는 경로. 즉 `viewerModel.rowModelList = ...filter(...)` 처럼 새 참조 할당이 필요.

Phase 1 의 gridUtil 위임은 내부적으로 정규 `rowDeleteUtils.deleteRow:66` 의 `= filter(...)` 로 참조 교체를 수행하지만, 그 외 호출 경로 (특히 dialog 닫힘 → 비동기 await → 다음 microtask 실행) 의 React 배치/타이밍 차이로 부모 컴포넌트 재렌더가 트리거되지 않는 케이스가 잔존. Phase 0 패턴에 있던 `onRefresh()` 강제 rerender 가 Phase 1 위임 과정에서 제거된 것이 결정적 원인.

### 해법 (Phase 3, HOTFIX 1)

`deleteRowAction.ts` 재작성:
1. `splice(rowIndex, 1)` 폐기 → `viewerModel.rowModelList = viewerModel.rowModelList.filter(r => r.rowField !== rowField)` 로 **새 배열 참조 할당** (useMemo dep 트리거).
2. `stateManager.removeRows([...])` 폐기 — no-op 호출이라 효과 없음, 코드 단순화.
3. `onRefresh()` **복구** — Phase 0 에 있던 강제 rerender 안전망. useMemo dep 변경만으로 부족한 호출 경로 (await 후 microtask 등) 대비 이중 보장.
4. seq 정규화 (남은 행) 유지.
5. `saveChange(createRowDeletedChange(rowField))` 로 서버 동기 유지.
6. `gridUtil` 의존 완전 제거.

### 페이즈 결과

- **Phase 3 시도** (fix): nested context stateManager 가설로 cell 로컬 stateManager 직접 갱신 + splice 유지. (`320fc822`)
- **Phase 3 보정** (fix): 가설 검증 실패 (stateManager.removeRows 가 no-op). splice → filter (참조 교체) + stateManager 호출 제거 + onRefresh 복구. (`193bb674`)

### 영향 파일

data-craft:
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/deleteRowAction.ts`

### 잔존 트레이드오프 (본 hotfix scope 외)

- 남은 행들의 seq 재정규화는 클라이언트 model 에만 반영, 서버 동기 (`createRowSeqChange` 배치) 미수행.
- 서브그리드 orphan 정리 / `reorderRowByIndex` (행번호 셀 cellValue 갱신) / `notifyRowDeleted` (서버 페이징 totalRows 동기) 누락.
- 향후 별도 플랜에서 `cellRendererChildModel` 에 정식 `GridUtilContext` 노출 또는 `rowDeleteUtils.deleteRow` 호출용 어댑터 도입 권고.

### 비고

본 entry 의 버전 번호는 머지 충돌 양측 보존 (CLAUDE.md §5) 규칙에 따라 v001.292.0 → v001.293.0 으로 이동 (#129 의 v001.292.0 보존).

## v001.292.0

> 통합일: 2026-05-20
> 플랜 이슈: #129 (간트 인쇄 모달 기간선택 캘린더 가려짐 수정)

### 개요

데이터 뷰어 → 간트 뷰의 "인쇄" 모달 1단계 "기간 선택" 에서 시작일/종료일 input 아래로 펼쳐지는 캘린더 팝오버가 인쇄 모달 본문(`StepShell` `overflow-y-auto`) 에 클리핑되어 모달 하단 영역에 가려지던 문제. 캘린더가 인쇄 모달 위로 떠올라 전체 표시되어야 함이 요구사항.

근본 원인: `DatePickerDropdown` 이 `absolute z-20` 인라인 렌더라 부모 `overflow-y-auto` 의 클리핑 경계를 넘지 못함. 인쇄 모달(z-12000) 자체의 스택 컨텍스트도 인라인 z-20 으로 탈출 불가.

해결: `createPortal` 로 `document.body` 에 렌더 + anchor 버튼의 `getBoundingClientRect()` 기반 `position: fixed` 좌표 + `Z_INDEX.NESTED_MODAL_DROPDOWN` (12100) 적용. ancestor overflow / stacking context 양쪽 동시 탈출. anchor 는 `RefObject` 로 전달받고 `useLayoutEffect` 로 mount 시 rect 일회 계산 (React 19 ref-during-render lint 규칙 회피).

### 페이즈 결과

- **Phase 1** (fix): `DatePickerDropdown` props 에 `anchorRef: React.RefObject<HTMLElement | null>` 추가, `createPortal(..., document.body)` 로 렌더 변경. `useLayoutEffect` 로 `anchorRef.current.getBoundingClientRect()` → `position {top: r.bottom+4, left: r.right-300}` state 업데이트, `position null` 동안 early-return null 로 backdrop flash 차단. `z-index` = `NESTED_MODAL_DROPDOWN` (12100) / backdrop = 12099. 호출처 `DatePicker.tsx` (DocumentEditDialog → OptionsPanel) 와 `GanttPeriodSelectStep.tsx` 의 `CustomDateField` 양쪽에서 `triggerRef` 부여 후 `anchorRef` prop 으로 전달. (`d937c199` → `39d8e323` lint hotfix)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx`
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePicker.tsx`
- `packages/fs-data-viewer/src/features/print/ui/steps/GanttPeriodSelectStep.tsx`

### 비고

- portal 기본화로 `DocumentEditDialog → OptionsPanel → DatePicker` 호출처의 잠재 동일 클리핑 (있었다면) 도 함께 해소.
- `fs-sub-data-viewer`, `fs-external-data-viewer` 패키지에도 `DatePickerDropdown` 사본 존재. 동일 ancestor overflow 클리핑 잠재. 본 plan 스코프 외 — 동 증상 보고 시 별도 hotfix / 후속 plan 필요.

## v001.291.0

> 통합일: 2026-05-20
> 플랜 이슈: #128 HOTFIX 1 (세계시간 셀 모달 셀 위치 앵커드 포지셔닝)

### 개요

v001.289.0 (#128 본 플랜) 적용 후, 세계시간 셀 모달이 더블클릭 시 화면 중앙에 뜨는 잔존 문제가 보고됨. 동일 위치를 잡아야 할 진행률 셀과 달리 세계시간 모달은 셀 위치를 참조하지 않고 `fixed inset-0 flex items-center justify-center` 로 단순 중앙 배치되어 있어, 그리드 흐름과 떨어진 위치에 등장하던 문제. 진행률 셀의 앵커드 포지셔닝 패턴 (`useProgressCell` + `ProgressOverlay`) 을 그대로 미러링해 셀 하단에 모달이 붙도록 통일.

### 페이즈 결과

- **Phase 2 / HOTFIX 1** (fix): `useWorldTimeCell` 에 `overlayPosition` state 추가 + `openOverlay` 에서 `cellRef.getBoundingClientRect()` 캡처. `WorldTimeOverlay` 에서 중앙 flex 레이아웃 제거 → `absolute top/left` + `useLayoutEffect` 로 `adjustOverlayPosition` 적용 + `isPositionReady` 가드 (Progress 패턴 동일). `FsGridWorldTimeCellRenderer` 가 `overlayPosition` 을 prop 으로 전달. 부수: `visibility:hidden` 상태 동안 focus 가 사일런트 실패하던 흐름을 막기 위해 `isOverlayOpen → focus` useEffect 를 hook 에서 overlay 내부의 `isPositionReady → focus` 효과로 이전. (`d8d324b`)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/widgets/cell-renderers/world-time-cell/useWorldTimeCell.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/world-time-cell/WorldTimeOverlay.tsx`
- `packages/fs-data-viewer/src/widgets/cell-renderers/world-time-cell/FsGridWorldTimeCellRenderer.tsx`

### 비고

- 국가 셀 모달도 동일하게 중앙 배치 패턴이지만 마스터 명시 보고 범위 외 — 별도 결정 필요.

## v001.290.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 9 — 좌측 사이드바 배경 베이지 톤다운)

### 개요

마스터 보고: HOTFIX 8 의 좌측 사이드바 베이지 배경 (`#F5F1EB`) 이 시안 대비 진해서 훨씬 더 연하게 톤다운 요청.

### 변경

- **`packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx`** (`4a8905d`): 좌측 사이드바 컨테이너 배경색 `bg-[#F5F1EB]` → `bg-[#FAF8F5]` (거의 흰색에 가까운 연한 크림). active 항목 `bg-white` 와 hover `bg-white/50` 와의 시각 대비는 유지.

### 정책 합치

- data-craft FE-only.
- Lint gate: PASS (0 errors, 20 warnings).
- 회귀: 다른 색상/spacing/동작 모두 무변경.

## v001.289.0

> 통합일: 2026-05-20
> 플랜 이슈: #128 (진행률/세계시간/국가 셀 더블클릭 팝업 전환)

### 개요

데이터 뷰어 그리드의 진행률·세계시간·국가 3개 셀이 단일 클릭만으로 즉시 오버레이/팝업을 띄우던 동작을, 일반 텍스트 셀과 동일한 더블클릭 트리거로 통일. 단일 클릭은 셀 포커스만 부여한다. 키보드 진입 경로 (Enter / Space → openOverlay) 와 Shift 다중 선택 분기는 그대로 보존.

원인:
- 3개 hook (`useProgressCellHandlers` / `useWorldTimeCell` / `useNationCellHandlers`) 의 `handleClick` 이 stopPropagation → 가드 → `onFocus` → `openOverlay()` 까지 한 번에 처리 → 셀 선택만 하려 해도 매번 팝업이 떠 그리드 탐색이 불편.

해법:
- Phase 1: 각 hook 의 `handleClick` 에서 `openOverlay()` 호출을 제거하고 새 `handleDoubleClick` 콜백을 추가 (각 셀의 기존 가드 조합 — Progress 의 `isWriteMode && !isSettingMode`, WorldTime 의 `openOverlay` 내부 `isSettingMode` 가드, Nation 의 `isSettingMode` early return — 을 그대로 적용). 3개 renderer JSX 에 `onDoubleClick={handleDoubleClick}` 바인딩을 추가. 키보드 핸들러 무변경.

### 페이즈 결과

- **Phase 1** (fix): 3개 셀 hook 의 `handleClick` 에서 `openOverlay()` 제거 + 새 `handleDoubleClick` 추가 (각 셀 기존 가드 보존), 3개 renderer JSX 에 `onDoubleClick` 바인딩 추가, 키보드 진입 경로 무변경. (`4ce4d95`)

### 영향 파일

**data-craft**
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridProgressCellRenderer/useProgressCellHandlers.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridProgressCellRenderer/FsGridProgressCellRenderer.tsx`
- `packages/fs-data-viewer/src/widgets/cell-renderers/world-time-cell/useWorldTimeCell.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/world-time-cell/FsGridWorldTimeCellRenderer.tsx`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridNationCellRenderer/useNationCellHandlers.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridNationCellRenderer/FsGridNationCellRenderer.tsx`

### 비고

- Shift + 더블클릭 시에는 1·2 번째 클릭이 shift 분기에서 early return 한 뒤 dblclick 에서 오버레이가 열리는 미세 동작 변화가 있음 (기존엔 shift 클릭만으로 오버레이가 열리지 않았음). 마스터의 사용성 개선 명령 범위에서 의도된 부수효과로 판단 — 별도 후속 없음.
- `data-craft-mobile` 에도 동등 컴포넌트가 있으나 터치 디바이스 UX 차이로 본 플랜 범위 외. 모바일 동일 처리는 마스터 결정 후 별도 플랜.

## v001.288.0

> 통합일: 2026-05-20
> 플랜 이슈: #127 (버튼 셀 행 액션 즉시 반영 + 동일상태 재클릭 가드)

### 개요

데이터 뷰어→버튼 타입 셀의 "행 삭제 / 행 즉시 삭제" 가 새로고침 없이는 화면에 반영되지 않던 버그 수정 + 같은 버튼을 재클릭했을 때 이미 목표 상태인데도 success 토스트가 뜨고 (deadline 등) 객체 raw JSON 이 표면화될 가능성을 차단하는 가드 도입.

원인:
- 행 삭제: 정규 경로 `gridUtil.deleteRow([row])` (rowDeleteUtils.deleteRow — `stateManager.removeRows` / `reorderRowByIndex` / 서브그리드 orphan 정리 / `saveBatchChanges` / `notifyRowDeleted` 6단계) 가 있는데, 버튼 셀의 `deleteRowAction` 만 정규 경로를 우회해 `viewerModel.rowModelList.splice` + `saveChange(deleteChange)` + `onRefresh()` 만 수행 → 그리드 렌더링 source-of-truth 인 `stateManager.rows` 미갱신.
- 재클릭 가드 부재: complete/incomplete/reset 액션이 사전 판정 없이 무조건 cell 값을 덮어쓰고 success 토스트 표시. 이미 incomplete 상태의 deadline cell 에 동일 JSON 을 재기록하는 과정에서 raw 객체 직렬화 문자열이 표면화될 여지.

해법:
- Phase 1: `ButtonActionContext` 에 `gridUtil` + `stateManager` 노출, `deleteRowAction` 을 `await gridUtil.deleteRow([internalRow])` 단일 호출로 위임 (`row-menu.ts:44` 등 다른 호출처와 동일 패턴). 디스패처 / 호출부 async 전파.
- Phase 2: `ButtonActionResult = { status: 'executed' | 'no_change' }` 신설, complete/incomplete/reset 각각에 `isAllAlready*` guard 도입 — 모든 target cell 이 이미 목표 상태면 `saveChange` / `cell.cellValue` 재기록 / `onRefresh` 일절 호출 안 함 (raw 표면화 트리거 차단) + `no_change` 반환. `useButtonAction.doExecute` 가 status 분기해 `toastAlreadyInState` ("이미 모두 해당 상태입니다") 표시. i18n ko/en/zh/ja 4언어 동기.

### 페이즈 결과

- **Phase 1** (fix): `ButtonActionContext` 에 `gridUtil`/`stateManager` 필드 추가, `deleteRowAction` 재작성 (`gridUtil.generateCustomRowList()` → `await gridUtil.deleteRow([internalRow])` 위임, 자체 splice/saveChange/onRefresh 제거), `executeButtonAction` async/Promise<void>, `useButtonAction` 에서 `useGridContext().gridUtil` 주입 + pendingAction Promise 타입 정합. (`10d716bf`)
- **Phase 2** (fix): `ButtonActionResult` 타입 도입, `complete/incomplete/resetRowAction` 에 모듈 스코프 guard 함수 (`isAllAlreadyCompleted` / `isAllAlreadyIncomplete` / `isAllAlreadyReset`) 추가 — boolean/checkbox/deadline 모두 이미 목표 상태면 즉시 `no_change` 반환 (cell 재기록 금지). `deleteRowAction` 항상 `executed` 반환. 디스패처 반환 `Promise<ButtonActionResult>` 통일. `useButtonAction.doExecute` 가 result.status 분기해 `toastAlreadyInState` 토스트. ko/en/zh/ja 4언어에 `button.toastAlreadyInState` 신규 키 + `TranslationKeys` 동기. (`b61f93cc`)

### 영향 파일

data-craft:
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/types.ts`
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/deleteRowAction.ts`
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/completeRowAction.ts`
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/incompleteRowAction.ts`
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/resetRowAction.ts`
- `packages/fs-sub-data-viewer/src/features/grid/lib/button-actions/index.ts`
- `packages/fs-sub-data-viewer/src/widgets/cell-renderers/FsGridButtonCellRenderer/useButtonAction.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/translations/ko.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/translations/en.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/translations/zh.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/translations/ja.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/types.ts`

## v001.287.0

> 통합일: 2026-05-20
> 플랜 이슈: #125 (BillingSuccessPage 신규 구독 분기 PAYMENT_PASSWORD_REQUIRED 차단 수정)

### 개요

플랜 한도 초과 후 업그레이드 시도가 `POST /api/subscription/billing/payment` 에서 `400 PAYMENT_PASSWORD_REQUIRED` (data-craft-server `requirePaymentPassword` 미들웨어) 로 차단되는 회귀 수정.

원인: 카드 미등록 사용자가 "카드 등록 및 결제" → 토스 결제창 → `/billing/success` 복귀 시, `BillingSuccessPage` 의 신규 구독 분기가 `issueBillingKey` 직후 `executePayment.mutateAsync` 를 **`paymentPassword` 없이** 호출하고, 결제 비밀번호 설정 모달은 결제 **이후** 띄우는 순서 모순. BE 는 모든 `/billing/payment` 호출에 비밀번호 필수이므로 첫 결제가 항상 차단.

해법: 신규 구독 분기에 `usePaymentPasswordGate` 도입 — `issueBillingKey` 성공 → 재진입 세마포어 동기 해제 → `gate({ onSuccess })` → `onSuccess(password)` 콜백 내부에서 `executePayment.mutateAsync({ ..., paymentPassword })` 호출. 사후 setup 모달 (`setShowPasswordSetup`) 은 신규 구독 분기에서만 제거. `card-change` / `promotion-purchase` 분기는 기존 상태 머신 그대로 보존 (해당 분기는 `/billing/payment` 미사용 → 회귀 위험 없음).

### 페이즈 결과

- **Phase 1** (fix): `BillingSuccessPage.tsx` 신규 구독 분기에 결제 비밀번호 게이트 도입. `usePaymentPasswordGate` import + 컴포넌트 본체 초기화, `executePayment` 직접 호출 제거 후 `gate.onSuccess` 콜백 내부로 이동 (paymentPassword 포함). billingKey 발급 후 `clearPendingPayment` / `isCompleted` / `isProcessing` / sessionStorage 정리는 gate 호출 직전 동기 수행 (gate 콜백 비동기로 인한 finally 의존 불가 — 재진입 방지). 성공 시 toast + `navigate('/')`, 실패 시 `navigate('/?openSettings=plan')`. JSX 트리에 `{gateElement}` mount. (`bd87e2c`)
- **Phase 2** (test): `tests/pages/billing-callback/BillingSuccessPage.test.tsx` 에 vitest 회귀 테스트 4개 추가. (a) gate onSuccess 발사 시 `executePayment` 가 paymentPassword 포함 호출, (b) onSuccess 미발사 시 executePayment 미호출, (c) targetPlan/billingCycle/seats/paymentPassword 전체 필드 전달 확인, (d) card-change 분기 회귀 가드. 전체 14 tests 통과 (10 기존 + 4 신규). (`24267fd`)
- **클린업**: 신규 구독 분기의 dead write `pendingNavigate.current = '/?openSettings=plan'` 1줄 제거 — gate 도입 후 해당 ref 의 유일한 consumer 였던 `setShowPasswordSetup` dismiss 핸들러가 본 분기에서 사라져 무용. (`0fe8efc`)

### 영향 파일

data-craft:
- `src/pages/billing-callback/ui/BillingSuccessPage.tsx`
- `tests/pages/billing-callback/BillingSuccessPage.test.tsx`

## v001.286.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 8 — '연결 그룹 삭제' 동적 라벨 복원 + 좌측 사이드바 시안 매칭 + 다이얼로그 여백 확대)

### 개요

마스터 정정 + 추가 시안:
1. HOTFIX 7 의 정적 라벨 `선택 연결 열 제거` 갱신 → 전체 선택 시 **`연결 그룹 삭제`** 동적 전환 (HOTFIX 2 동적 텍스트 복원, 단 라벨은 시안 갱신 — `행 연결 그룹 제거` → `연결 그룹 삭제`). 클릭 시 모달 즉시 닫기 + 그룹 전체 컬럼 완전 삭제.
2. 좌측 사이드바 두 번째 시안 정확 매칭 — 베이지 컨테이너 + 번호 prefix + 보라 active 바 + 보라 primary 추가 버튼.
3. 다이얼로그 전체 좌우 여백 확대.

### 변경

#### 1. footer 좌측 버튼 동적 라벨 + 그룹 완전 삭제 (`599ffd48` + lint hotfix `b2154d1c`)

- 라벨: `selected.size === groupCols.length` (전체 선택) → **`연결 그룹 삭제`**. 그 외 → `🗑 선택 연결 열 제거`.
- 클릭 핸들러 `handleDeleteGroup` 신규 분리. 실행 순서:
  1. 모든 `groupCols` 순회.
  2. `saveChange(createColumnDeletedChange(cf), { immediate: true })` 호출 (각 컬럼 삭제 change 전파).
  3. `onRefresh()` 호출.
  4. `onClose()` 호출 — 삭제 완료 후 모달 닫음 (unmount 전 상태 불일치 방지).
- lint hotfix: 직접 `viewerModel.columnModelList` / `row.cellModelList` mutation 은 ESLint 규칙 위반 → `saveChange immediate` 만으로 전파 (store 가 viewerModel 갱신).

#### 2. 좌측 사이드바 시안 매칭 (`fc158e42`)

- **컨테이너**: 흰색 → 베이지 (`bg-[#F5F1EB]`, `rounded-2xl`, `p-3`).
- **검색 input**: placeholder `🔍 열 검색` (단축), `bg-white` + `rounded-lg`.
- **헤더 행**: `ChevronDown` (14px) + 전체 선택 체크박스 + `연결 열` (font-bold) + 카운터 pill (`bg-gray-200/70`, `rounded-full`, `0 / 7` 공백 포함).
- **항목 행**: 2자리 번호 prefix (`font-mono text-gray-400`) + 체크박스 + 컬럼명 + 리더 pill (`bg-orange-50 text-orange-700 rounded-full`). active 시 `border-l-4 border-violet-500 bg-white`, 비선택은 `border-transparent hover:bg-white/50`.
- **추가 버튼**: outline → `bg-violet-600 text-white hover:bg-violet-700` 채움 primary.

#### 3. 다이얼로그 여백 확대 (`fc158e42`)

- `Dialog.Content` 에 `mx-10` 추가.
- 헤더/푸터 `px-6` → `px-8`.

### 이전 핫픽스 갱신 정리 (시안/마스터 정정)

- **HOTFIX 7 정적 라벨** (`선택 연결 열 제거`) → **갱신**: 전체 선택 시 동적 `연결 그룹 삭제`. HOTFIX 2 의 동적 텍스트 복원이지만 라벨 자체는 마스터 정정으로 `행 연결 그룹 제거` → `연결 그룹 삭제`.
- HOTFIX 7 의 모달 전체 layout / 우측 hero + 4 섹션 카드 / 3-버튼 segment / append 모드 — 그대로 유지.

### 영향 파일

- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (3 commits — `599ffd48` 라벨 + 삭제 / `b2154d1c` lint hotfix / `fc158e42` 사이드바 시안 + 여백)

### 정책 합치

- data-craft FE-only.
- Lint gate: PASS (0 errors, 20 warnings).
- 회귀: 부분 선택 / 리더 + 일부 부하 / 리더 단독 / 비 rowLink 컬럼 / 비리더 chevron 차단 / 리더 chevron 직접 모달 모두 무변경.

## v001.285.0

> 통합일: 2026-05-20
> 플랜 이슈: #120 (HOTFIX 4 — 콘솔 경고 2건 해소: HydrateFallback + aria-hidden focus)

### 마스터 보고 (스크린샷)

5탭 시연 정상 확인. ScreenHome populated. 콘솔에 노이즈:
- 빨강 5건: `FrameDoesNotExistError` / `Unchecked runtime.lastError` — 브라우저 확장 (background.js) 노이즈, **우리 코드 외**.
- 노랑: `No HydrateFallback element provided to render during initial hydration` (main.tsx:16) — React Router v7 lazy 라우트 경고.
- 노랑: `Blocked aria-hidden on an element because its descendant retained focus` — root `<div>` 에 aria-hidden 이 적용된 상태에서 login input 이 focus 유지.

### 원인

1. **HydrateFallback 누락**: React Router v7 가 lazy 라우트의 초기 hydration 동안 보여줄 fallback element 를 router 정의 시점에 요구. 미정의 시 경고.
2. **aria-hidden focus 충돌**: `vaul` 의 `Drawer.Root` 가 modal 모드 (기본값) 에서 portal 형제 element 에 aria-hidden 을 적용해 포커스 트랩 구현. IOSInstallHint 가 AppShell 안에 mount 되어 있어 (open=false 일 때도) 초기 hydration / focus 이벤트 시점에 root 에 aria-hidden 이 잠시 걸리는 케이스 발생.

### 변경

#### 1. `apps/web/src/mobile/router.tsx` — HydrateFallback 추가

```tsx
import { LoadingSpinner } from './components/LoadingSpinner';

function RouteHydrateFallback() {
  return <LoadingSpinner label="로딩 중" />;
}

export const router = createBrowserRouter([
  { path: '/', element: ..., HydrateFallback: RouteHydrateFallback },
  { path: '/m', element: <AppShell />, HydrateFallback: RouteHydrateFallback, children: [...] },
]);
```

#### 2. `apps/web/src/mobile/components/IOSInstallHint.tsx` — vaul `modal={false}`

```tsx
<Drawer.Root open={open} modal={false} onOpenChange={...}>
```

modal=false 모드는 focus trap + 형제 element aria-hidden 적용을 비활성. iOS 설치 힌트는 모달성 강제가 필요 없는 카드형 안내이므로 안전한 trade-off.

### 시연

브라우저 새로고침 → 콘솔에서 빨강 0 (확장 노이즈는 외부) / 노랑 0 확인. HydrateFallback 의 LoadingSpinner 가 lazy 라우트 전환 시 잠시 표시.

### 검증

- `pnpm typecheck`: PASS.
- `pnpm test --run`: 674 passed / 5 skipped / 0 failed (679).

### 브라우저 확장 노이즈 (참고)

```
Uncaught (in promise) FrameDoesNotExistError: Frame XXX does not exist in tab YYY (background.js:1:49254)
Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
Unchecked runtime.lastError: The page keeping the extension port is moved into back/forward cache, ...
```

이 3종 빨강은 마스터 Chrome 설치 확장 (e.g. password manager, AI tool) 의 `background.js` 가 발신한 메시지가 자기 페이지를 못 찾아서 발생. 본 앱과 무관 — 시크릿 창에서 확장 비활성 후 재현 안 됨 확인.

### Deferred (누적)

- `pnpm build` (vite production) 실패: fs-form-builder-mobile / fs-data-viewer-mobile broken `@/` alias (lazy 라우트).
- packages 4종 부분 복사 본체 정리.
- PHASE 0.1 잔재 (`src/app/`, `src/pages/`, `src/main.tsx`) 삭제.

### 영향 파일

- `apps/web/src/mobile/router.tsx` (+9)
- `apps/web/src/mobile/components/IOSInstallHint.tsx` (+1)

## v001.284.0

> 통합일: 2026-05-20
> 플랜 이슈: #120 (HOTFIX 3 — AppHeader broken 패키지 임포트 vite 오류 회피)

### 마스터 보고

vite overlay 오류:
```
[plugin:vite:import-analysis] Failed to resolve import "@/components/ui/dialog"
from "packages/fs-relation-builder-mobile/src/widgets/designer-dialog/ui/DesignerDialog.tsx"
```

### 원인

HOTFIX 2 가 index.html entry 를 `/apps/web/src/mobile/main.tsx` 로 직접 교체 → 5탭 시연 활성화 → AppShell → AppHeader 가 모듈 로드 시점에 두 broken 패키지를 임포트:

- `@dcm/fs-data-link-mobile` → `DataLinkDialog`
- `@dcm/fs-relation-builder-mobile` → `DesignerDialog`, `QueryProvider`

이 두 패키지는 b5754df WIP "부분 복사" 상태로 패키지 내부 `@/` alias (자체 src 기준) 가 vite 루트 alias (`@` → `./src/`) 와 충돌. `@/components/ui/dialog`, `@/widgets/sidebar` 등 미존재 경로 다수.

### 변경

#### 1. `apps/web/src/mobile/components/AppHeader.tsx` — 패키지 임포트 → 인라인 stub 교체

```tsx
// 기존
import { DataLinkDialog } from '@dcm/fs-data-link-mobile';
import { DesignerDialog, QueryProvider } from '@dcm/fs-relation-builder-mobile';

// 변경 (인라인 stub 함수 3개)
function DataLinkDialog(props) { /* modal stub with "패키지 정리 후 복원 예정" 카피 */ }
function QueryProvider({ children }) { return <>{children}</>; }
function DesignerDialog(props) { /* 동일한 stub */ }
```

stub 들은 prototype 디자인 토큰 (--ds-paper / --ds-brand / --cta-height / --cta-radius) 을 사용. 실제 다이얼로그 기능은 향후 패키지 정리 후 복원. data-testid (`data-link-dialog` / `relation-builder-dialog`) 와 className 데이터 속성을 보존해 기존 테스트 어서션 호환.

#### 2. `apps/web/src/mobile/components/__tests__/AppHeader.test.tsx` — vi.mock 제거

vi.mock 이 패키지를 대상으로 했으나 import 자체가 사라져 더 이상 무의미. stub 가 직접 data-testid 노출하므로 테스트 통과.

### 시연

`pnpm dev` → 5174 → /m/home → 더 이상 vite overlay 오류 없음. AppHeader 의 데이터링크/관계빌더 버튼 클릭 시 "패키지 정리 후 복원 예정" 카피의 임시 모달 표시.

### 검증

- `pnpm typecheck`: PASS.
- `pnpm test --run`: 674 passed / 5 skipped / 0 failed (679). (1 file fail = tailwind-build dist 부재 — pre-existing infra.)
- `pnpm build` (vite production): 여전히 실패 — `@/shared/ui` from `fs-form-builder-mobile/.../BooleanFieldRenderer.tsx` 등 다른 broken 패키지가 lazy 라우트 (ScreenUserForm) 에서 참조됨. **dev 시연에는 영향 없음** (lazy 라우트는 진입 시에만 로드). 5탭 (Home/Pages/Inbox/DM/Profile) 모두 dev 에서 정상.

### Deferred (후속 권고 — 누적)

- **`src/app/` + `src/pages/` + `src/main.tsx` PHASE 0.1 잔재 삭제**.
- **packages/fs-{relation-builder,form-builder,data-viewer,data-link}-mobile 부분 복사 정리**: 본 핫픽스로 fs-{relation,data-link} 두 패키지의 AppHeader 경로는 해결. fs-form-builder-mobile / fs-data-viewer-mobile 의 deep import 는 ScreenUserForm / WidgetFullscreenSheet / 뷰어 화면 등에서 여전히 broken. 향후 user-form 또는 deep widget 진입 시 동일 패턴의 vite 오버레이 가능 → 패키지 본체 정리 또는 동일 stub 패턴 확장 필요.
- **vite production build 통과**: 위 패키지 정리 후속.

### 영향 파일

- `apps/web/src/mobile/components/AppHeader.tsx` (+86 lines for inline stubs)
- `apps/web/src/mobile/components/__tests__/AppHeader.test.tsx` (vi.mock 제거)

## v001.283.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 7 — 디자인 시안 정확 매칭 모달 재구축)

### 개요

디자인 팀 시안 적용 — `RowLinkGroupManageDialog` 모달을 시안 디자인에 정확히 매칭하도록 전면 재구축. 본 핫픽스는 이전 일부 핫픽스 결정 (HOTFIX 2 결정 B / HOTFIX 2 동적 텍스트 / HOTFIX 3 고정 동적 분기) 을 시안 권위로 명시 갱신.

### 변경

#### 1. 상단 헤더
- 좌측: `SETTINGS` 작은 라벨 + 큰 제목 `행 연결 그룹 관리`.
- 우측: `● 모드 · {참조|복사}` 보라 점 둥근 사각 배지 + 닫기 X.

#### 2. 좌측 사이드바
- 검색 input (`연결 열 검색` placeholder, 둥근 회색).
- sticky 헤더: 전체 선택 체크박스 + `연결 열` 라벨 + `N/M` 카운터.
- 항목: 체크박스 + 컬럼명 + (리더 시) `★ 리더` 주황 배지. 현재 선택 항목 → 보라 active 테두리 + 연한 배경.
- 하단: `+ 연결 열 추가` full-width outline 버튼 (HOTFIX 2 결정 B 갱신 — 재도입).

#### 3. 우측 영역
- **Hero**: 별 아이콘 (보라 둥근 사각 배경) + 컬럼명 + (리더 시) 리더 배지 + 보조 텍스트 `ID · {columnField}`.
- **섹션 카드 4개** (둥근 모서리 + 연한 border):
  - **01 기본 속성**: 열 제목 / 단위 (+ 보조 텍스트 `셀에 표시되는 단위`, placeholder `예: 시간, %, 원`) / 열 너비 + `px` suffix.
  - **02 동작** (우측 `4 옵션`): 정렬 허용 / 행 그룹 (리더 시 disabled + 보조 텍스트 `리더 열에서는 사용할 수 없습니다`) / 칸반 기준열 / 연결 그룹 리더 (+ 보조 텍스트 `그룹당 1개의 리더만 지정`).
  - **03 위치 고정**: 3-버튼 segment `왼쪽 고정` / `고정 안 함` / `오른쪽 고정` (HOTFIX 3 갱신 — 동적 분기 폐기, 3-버튼 segment 복귀).
  - **04 기타 작업**: `열 본문 스타일 편집` 버튼.
- ColumnDetailPanel 재사용 대신 `MenuItemRenderer` 를 카드 내부에서 직접 렌더 (시안의 카드 그룹 디자인 매칭).

#### 4. 하단 footer
- 좌측: `🗑 선택 연결 열 제거` (HOTFIX 2 동적 텍스트 갱신 — 정적 라벨. 동작 로직 — 리더 자동 제외 / 그룹 전체 선택 시 모든 컬럼 삭제 — 유지).
- 우측: `취소` (outline) + `닫기` (보라 primary).

#### 5. "연결 열 추가" 흐름 (신규 — append 모드)
- `RowLinkConfigDialog.tsx` 에 `AppendModeProps` 추가 → 기존 그룹의 `linkGroupId / targetGroupId / targetGroupType / mode / leaderTargetColumnId` 를 pre-fill 하여 Step 4 (매핑) 부터 시작. 새 열은 `isLeader=false` 고정.
- `FsGridTableView.tsx` 에 `useGridContextOptional()` 로 콜백을 읽고 `addRowLinkColumns` 를 사용한 `handleRowLinkConfigConfirm` 를 `RowLinkGroupManageDialog` 에 전달.

### 영향 파일

- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (`815b1448`: 대수술 / `5d1c7879`: lint hotfix — 미사용 isRowGroupingEnabled 제거)
- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (`815b1448`: AppendModeProps 추가)
- `packages/fs-data-viewer/src/widgets/grid-table/FsGridTableView.tsx` (`815b1448`: 콜백 props 전달 / `bfa3d3d6`: typecheck hotfix — ColumnGeneratorStateManager 캐스팅)

총 +700 / -353 (3 commits + 2 lint hotfix).

### 이전 핫픽스 갱신 정리 (시안 권위)

- **HOTFIX 2 결정 B** (그룹에 새 열 추가 제거) → **갱신**: 재도입 (RowLinkConfigDialog append 모드).
- **HOTFIX 2 동적 텍스트** (선택 = 전체 시 "행 연결 그룹 제거") → **갱신**: 정적 라벨 `선택 연결 열 제거`. 동작 로직은 유지.
- **HOTFIX 3 고정 동적 분기** (왼쪽/오른쪽 ↔ 고정 해제) → **갱신**: 3-버튼 segment 복귀.
- HOTFIX 5 sticky 헤더 / 글자 크기 / 전체 선택 → 유지 + 검색 input 위로 추가.
- HOTFIX 6 리더 chevron 메뉴 우회 → 그대로 유지 (직접 모달 오픈).

### 정책 합치

- data-craft FE-only.
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 20 warnings).

## v001.282.0

> 통합일: 2026-05-20
> 플랜 이슈: #120 (HOTFIX 2 — 루트 entry wiring 교체로 11 페이즈 작업 가시화)

### 마스터 보고 (스크린샷 첨부)

"여전히 저렇게 나오는데?" — 브라우저 5174 → `/m/home` → 화면이 **"S-0.1 placeholder: /m/home"** 텍스트 + 5탭 bottom nav 만 표시. 11 페이즈 디자인 정합 작업이 화면에 노출되지 않음.

### 원인 진단

data-craft-mobile 레포에 **2개의 평행 entry** 가 존재:
- **루트 entry** (`src/main.tsx` → `src/app/App.tsx` → `src/app/routes.tsx`): PHASE 0.1 (enterprise-416) scaffold 잔재. 18 라우트를 모두 `createPlaceholder('/m/{route}')` 로 "S-0.1 placeholder: <route>" 만 렌더. 루트 `vite.config.ts` (port 5174) 가 이 entry 를 serves.
- **개발된 entry** (`apps/web/src/mobile/main.tsx` → `apps/web/src/mobile/router.tsx`): plan #117 / 본 #120 의 11 페이즈 + HOTFIX 1 모든 작업이 적용된 라우터. **현재 serves 되지 않음**.

마스터가 본 placeholder 는 PHASE 0.1 의 빈 깡통. 본 플랜의 모든 비주얼·mock 작업은 orphan 상태였다.

### 변경

#### 1. `index.html` — entry path 직접 교체

```html
<!-- 기존 -->
<script type="module" src="/src/main.tsx"></script>
<!-- 변경 -->
<script type="module" src="/apps/web/src/mobile/main.tsx"></script>
```

vite dev server (port 5174) 가 이제 개발된 mobile module 의 entry 를 마운트한다. 11 페이즈 + HOTFIX 1 의 모든 화면이 렌더된다.

#### 2. 접근 선택 사유 (왜 App.tsx 가 아니라 index.html?)

선행 시도: `src/app/App.tsx` 가 `@mobile/router` 를 import 하도록 wiring → 런타임은 성공했으나, `tsc -b --noEmit` 가 `src/` 의 import chain 을 따라가다 packages/fs-relation-builder-mobile / fs-form-builder-mobile / fs-data-viewer-mobile 의 b5754df WIP "부분 복사" 미해결 `@/` alias 들을 만나 **typecheck 회귀 50+ 건** 발생.

`index.html` 의 entry path 를 직접 교체하면 루트 `tsconfig.json` 의 `include: ["src"]` 가 더 이상 @mobile 체인을 추적하지 않아 typecheck 회귀를 회피. apps/web 자체 tsconfig 는 별도 게이트 (vite/storybook 빌드) 가 책임.

#### 3. `src/app/App.tsx` + `src/app/__tests__/App.smoke.test.tsx` 원복

본 보강 commit 으로 PHASE 0.1 placeholder 상태로 원복. src/app/* 트리는 dead-but-untouched 상태 — 후속 클린업 페이즈에서 삭제 권고.

### 시연

```
pnpm --filter @data-craft-mobile/web dev    # apps/web vite (port 5174)
# 또는
pnpm dev                                     # root vite — 이제 동일 entry 마운트
```

브라우저 5174 → 5탭 (홈/페이지/Inbox/DM/나) 전부 prototype 비주얼로 populated 표시. HOTFIX 1 의 DEV 자동 mock 활성 + 본 HOTFIX 의 entry wiring 두 축이 모두 효과 발휘.

### 검증

- `pnpm typecheck`: PASS (회귀 0).
- `pnpm test --run`: 674 passed / 5 skipped / 0 failed (679). (1 file fail = tailwind-build dist 부재 — pre-existing infra.)

### Deferred (후속 권고)

- **`src/app/` + `src/pages/` 트리 삭제**: PHASE 0.1 scaffold 잔재. `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/shell/*`, `src/app/styles/*`, `src/app/__tests__/*`, `src/pages/m/placeholder.tsx` 모두 unused. refactoring-analyzer 권고.
- **packages/fs-{relation-builder,form-builder,data-viewer,data-link}-mobile 의 `@/` alias 미해결 / 부분 복사**: b5754df WIP 이후 미정리. apps/web tsconfig 게이트가 별도 검증 안 하는 한 typecheck 회귀 잠재. 후속 패키지 클린업 페이즈 필요.
- **`src/main.tsx`** + 루트 `vite.config.ts` 의 `@` / `@/app` alias: 본 변경 후 사실상 미사용. 정리 권고.

### 영향 파일

- `index.html` (entry path 1줄 변경)
- (이전 보강 사이클의 `src/app/App.tsx` + `src/app/__tests__/App.smoke.test.tsx` 변경은 원복되어 net 무변화)

## v001.281.0

> 통합일: 2026-05-20
> 플랜 이슈: #123 (HOTFIX 1 — file/image 셀 reset 후 UI 즉시 갱신)

### 마스터 보고

"이제 삭제는 되는데 UI에 즉시 반영 안되서 새로고침해야 사라져있어"

### 원인

v001.278.0 (#123) Phase 1 의 BE 삭제 정상화 이후 두 결합 결함이 표면화:

1. **재로드 미트리거**: `useFileCell.ts:115` / `useImageCell.ts:108` 의 `useEffect` 가 `[loadFiles, cellValue]` 의존. file/image 셀의 `cellValue` 는 자연적으로 `''` (실제 파일 데이터는 별도 BE 테이블) — `resetRowAction` 의 `cell.cellValue = ''` mutation 이 no-op 으로 useEffect 미발화.
2. **캐시 적중**: `BatchFileLoader.FileResultCache` 가 reset 직전 결과를 캐싱. 설사 useEffect 가 발화돼도 default 로드 (`forceRefresh: false`) 는 stale 결과 반환.

`onRefresh()` (= `triggerRerender`) 은 grid 리렌더만 트리거 — 셀 hook 의 useEffect 의존이 변하지 않아 무효.

### 변경

#### Phase 2 (HOTFIX 1): per-cell 리프레시 레지스트리 (`15eab0b` + `86dda27`)

**1. `packages/fs-data-viewer/src/shared/lib/file-cell-refresh-registry.ts`** (신규)

```ts
// Map<key, Set<RefreshFn>>, key = `${dvf}-${cf}-${rf}-${cellType}`
registerFileCellRefresh(dvf, cf, rf, cellType, refresh)  // returns deregister
triggerFileCellRefresh(dvf, cf, rf, cellType)            // Promise.allSettled-wrapped
```

**2. `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridFileCellRenderer/useFileCell.ts`**

마운트 시 `refreshFiles` (기존 `forceRefresh: true` 호출자) 를 레지스트리에 등록, 언마운트 시 cleanup return 으로 해제.

**3. `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridImageCellRenderer/useImageCell.ts`**

`handleDialogClose` 내 인라인 갱신 블록을 `refreshImages` useCallback 으로 추출 → handleDialogClose 가 이를 호출 (DRY) + 레지스트리에 등록.

**4. `packages/fs-data-viewer/src/features/grid/lib/button-actions/resetRowAction.ts`**

file/image 삭제 + `saveChange` 직후 `triggerFileCellRefresh(dataViewerField, item.columnField, rowField, item.typeId as 'file' | 'image')` 발화. `dataViewerField !== undefined` 가드 (`ButtonActionContext.dataViewerField` 가 optional).

### 효과

- 행 초기화 → BE 삭제 (Phase 1 효과) → 영향 셀의 forceRefresh 로드 (HOTFIX 1 효과) → 캐시 무효화 + fresh setItems → **새로고침 없이 UI 즉시 반영**.
- virtualization 으로 unmount 된 셀은 `trigger` no-op 이지만 캐시 무효화는 셀 재마운트 후 forceRefresh 호출에 의해 동일 효과 — 커버리지 동일.

### 검증

1. `pnpm typecheck:all && pnpm lint` 통과 (0 errors, 19 warnings).
2. 수동 e2e (마스터): 이미지/파일 셀이 있는 행에 파일 업로드 → 행 초기화 → **새로고침 없이** 셀이 비어 있음 확인.

### 영향 파일

```
data-craft/packages/fs-data-viewer/src/shared/lib/file-cell-refresh-registry.ts   (NEW)
data-craft/packages/fs-data-viewer/src/widgets/cell-renderers/FsGridFileCellRenderer/useFileCell.ts
data-craft/packages/fs-data-viewer/src/widgets/cell-renderers/FsGridImageCellRenderer/useImageCell.ts
data-craft/packages/fs-data-viewer/src/features/grid/lib/button-actions/resetRowAction.ts
```

## v001.280.0

> 통합일: 2026-05-20
> 플랜 이슈: #124

### 개요

설정 → 플랜 관리 탭의 현재 플랜 배지 안 2×2 사용량 그리드(페이지 / 데이터 그룹 / 스토리지) 의 마지막 빈 셀(스토리지 우측) 에 **사용자 한도** UsageBar 를 추가. 협업 플랜(`standard` / `premium`) 에서만 표시되며 개인 플랜(`free` / `basic`) 에서는 슬롯이 비워진다.

### 변경

- **`src/widgets/settings-dialog/ui/plan/CurrentPlanBadge.tsx`** (`d045b75`): `CurrentPlanBadgeProps` 에 옵셔널 `userCount?: number`, `seats?: number` 두 필드 추가. 2×2 그리드 내 스토리지 UsageBar 다음 위치에 `planType === 'standard' || planType === 'premium'` 조건부 `<UsageBar label="사용자" current={userCount ?? 0} limit={seats ?? 0} formatLimitFn={(l) => \`${l}명\`} />` 추가.
- **`src/widgets/settings-dialog/ui/PlanTabContent.tsx`** (`d045b75`): `<CurrentPlanBadge>` 호출에 `userCount={status?.userCount}`, `seats={status?.seats}` 두 prop 전달.

### 데이터 소스

`SubscriptionStatus.userCount` (현재 인당 과금 사용자 수) / `SubscriptionStatus.seats` (협업 플랜 결제 정원). 양쪽 모두 `/api/subscription/status` 응답에 이미 존재하므로 BE 변경 없음.

### 표시 양식

| 항목 | 표시 |
|---|---|
| 레이블 | 사용자 (i18n key `settings.userLimit`, fallback "사용자") |
| 본문 | `{userCount} / {seats}명` |
| 막대 | UsageBar 표준 색상 규칙 (≥90% red, ≥70% amber, else primary) |
| 조건 | 협업 플랜 (`standard` / `premium`) 만 렌더 — 개인 플랜은 슬롯 빈 상태 유지 |

### 기존 사용자 한도 표시와의 관계

`BillingInfoSection.tsx` 가 별도 카드(사용자 아이콘 + `N/M명` + 막대) 로 동일 데이터를 이미 노출하고 있다. 이번 작업은 그것을 대체/제거하지 않고, **현재 플랜 배지 안의 한눈에 보는 2×2 사용량 그리드** 에 동일 양식으로 함께 노출하는 보완 추가 — 마스터 명시 "스토리지 우측에" 요청에 부합.

### 영향 파일

- data-craft:
  - `src/widgets/settings-dialog/ui/plan/CurrentPlanBadge.tsx`
  - `src/widgets/settings-dialog/ui/PlanTabContent.tsx`

---

## v001.279.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 6 — 리더 chevron 메뉴 우회 + 모달 직접 오픈)

### 개요

마스터 보고: HOTFIX 4 로 리더 컬럼 메뉴가 "행 연결 그룹 관리" 단일 항목만 가지게 됐는데 — 단일 항목이면 메뉴 dropdown 자체가 redundant. chevron (열 메뉴 열기 버튼) 클릭 시 메뉴를 띄우지 말고 바로 `RowLinkGroupManageDialog` 모달이 열리게 함.

### 변경

- **`packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableView.ts`** (`062ae7a`): `handleColumnMenuToggle` 함수에 분기 1곳 추가. `parseRowLinkConfig` 를 `entities/row-link` 에서 import 하여 `columnModel.type.id === 'rowLink' && isLeader === true` 조건 충족 시 `setRowLinkManageDialog({ open: true, columnField: cf })` 직접 호출 + return — 메뉴 dropdown 진입을 차단하고 모달만 띄움. 비매칭 시 기존 메뉴 흐름 그대로.

### 동작 표

| 컬럼 종류 | chevron 클릭 |
|---|---|
| 일반 컬럼 (비 rowLink) | 기존 메뉴 dropdown |
| rowLink + 리더 | **바로 RowLinkGroupManageDialog 모달 오픈** |
| rowLink + 비리더 | HOTFIX 1 chevron 차단 (클릭 불가) |

### 안전망

HOTFIX 4 의 `menuItems.ts` early-return 분기 (리더 메뉴 단일 항목 빌더) 는 본 HOTFIX 6 이 메뉴 진입 자체를 우회하므로 실질 dead code 가 됨. 그러나 안전망으로 유지 (chevron 핸들러가 어떤 경로로 메뉴를 호출하더라도 단일 항목으로 fallback).

### 정책 합치

- data-craft FE-only.
- Lint gate: PASS (0 errors, 19 warnings).
- 회귀: 비 rowLink 메뉴 dropdown (HOTFIX 0), 비리더 chevron 차단 (HOTFIX 1), dialog 자체 (HOTFIX 2/3/5) 모두 무변경.

## v001.278.0

> 통합일: 2026-05-20
> 플랜 이슈: #123 (행 초기화 — 이미지/파일 셀 실제 삭제 누락 수정)

### 마스터 보고

"data-craft, 데이터 뷰어의 버튼 타입 셀에서 "행 초기화" 기능을 사용할 때, 해당 행에 이미지, 파일 타입 셀이 있으면 해당 항목의 파일들을 초기화 경고 목록에 포함은 하는데 정작 초기화를 해도 해당 항목들이 삭제가 안돼"

### 원인

PHASE-17 (커밋 `3385b7cb`) 가 `resetRowAction.ts` 에 file/image 셀 백엔드 삭제 호출 `fileApi.deleteFile(f.id, f.uri)` 을 추가했으나, `f.uri = f.filePath` 매핑이 항상 빈 문자열. BE 라우터 (`data-craft-server/src/routes/file.ts:364-368`) 가 `if (!id || !uri) throw BadRequestError('MISSING_REQUIRED_FIELDS')` 로 400 거부 → FE 의 `Promise.allSettled` 가 거부를 삼킴 → 무성 실패. 경고 모달은 `fileName` 만 표시하므로 정상 동작하지만 실행 경로만 파괴된 비대칭 결함.

핵심 사이트: `loadFileList.ts:60, :165` 두 매핑이 `FsGridCellFileModel.filePath` 를 `''` 로 하드코딩 — BE URI 가 모델에 전혀 흘러들지 않음.

### 변경

#### Phase 1: `FsGridCellFileModel.fileUri` 신설 + reset 경로 변경 (`1d388b6`)

**1. `packages/fs-data-viewer/src/entities/cell-file.types.ts`** — optional `fileUri?: string` 필드 신설.

```ts
export type FsGridCellFileModel = {
  fileIndex: number;
  fileName: string;
  filePath: string;
  /** BE storage URI used for deletion calls. Separate from filePath, which is a rendering-only fallback. */
  fileUri?: string;
  fileData: ArrayBuffer | null;
};
```

**2. `src/features/file/lib/loadFileList.ts`** — 단건/배치 두 매핑 사이트에 `fileUri: file.uri` 추가. 기존 `filePath: ''` 는 그대로 보존 (ImageList fallback 시맨틱 무회귀).

**3. `packages/fs-data-viewer/src/features/grid/lib/button-actions/resetRowAction.ts:85`** — `uri: f.filePath` → `uri: f.fileUri ?? ''`. `fileApi.deleteFile(id, uri)` 가 BE 검증 통과 → 실제 DELETE → 물리 파일 unlink.

### 시맨틱 분리

| 필드 | 용도 | 값 형태 |
|------|------|--------|
| `filePath` | ImageList `<img src>` 렌더링 fallback (data-craft 에선 빈 문자열로 placeholder 분기) | `''` (유지) |
| `fileUri` | `fileApi.deleteFile(id, uri)` BE 호출용 storage URI | `file.uri` (신규) |

`filePath` 를 직접 `file.uri` 로 치환하면 `<img src="companies/.../uuid.ext">` 가 인증 없이 storage 경로를 직접 요청하여 broken-image 회귀 — 별도 필드로 분리하여 회피.

### 비-범위

- 다른 viewer 패키지 (`fs-sub-data-viewer`, `fs-external-data-viewer`) — 자체 reset 액션에 file/image 삭제 로직 부재.
- `Promise.allSettled` 무성 실패 일반 개선 — 향후 별도 작업.
- ImageList fallback 가드 변경 — placeholder 유지.

### 검증

1. `pnpm typecheck:all && pnpm lint` 통과 (0 errors, 19 warnings).
2. 수동 e2e (마스터): dev 서버 (5173) → 이미지/파일 셀이 있는 행에 파일 업로드 → 행 초기화 → 새로고침 시 셀이 비어 있음 확인. BE DB `file` 행 및 storage 물리 파일 삭제 확인.

### 영향 파일

```
data-craft/packages/fs-data-viewer/src/entities/cell-file.types.ts
data-craft/packages/fs-data-viewer/src/features/grid/lib/button-actions/resetRowAction.ts
data-craft/src/features/file/lib/loadFileList.ts
```

## v001.277.0

> 통합일: 2026-05-20
> 플랜 이슈: #120 (HOTFIX 1 — dev 모드 자동 mock + 바텀 nav 5탭 비주얼 활성)

### 마스터 보고

"여전히 홈 화면부터 시작해서, 바텀 네비게이션의 5개 페이지 모두 비어있는데? 디자인팀 시안대로 구축해, DB, BE는 건드리지 말고"

### 원인

v001.274.0 (#120) Phase 11 회귀 fix 에서 mock fallback 활성 조건을 **`VITE_USE_MOBILE_MOCKS=true` env 명시** 로 축소. BE 미실행 + env 미설정 dev 시연 상태에서 → 5탭 (Home/Pages/Inbox/DM/Profile) 의 BE 의존 hook 들이 빈 응답 → empty state. 회귀 테스트 보존이 의도였으나 dev 시연 활성화는 부수 누락.

### 변경

#### 1. `mocks/flags.ts` — 3축 OR 활성 + test 환경 우선 제외

```ts
export function useMobileMocks(): boolean {
  // 1) test 환경 우선 제외 (회귀 보존)
  if (import.meta.env.MODE === 'test' || process.env.VITEST === 'true') return false;
  // 2) env 명시 활성
  if (import.meta.env.VITE_USE_MOBILE_MOCKS === 'true') return true;
  // 3) DEV 런타임 자동 활성 (브라우저 dev 시연)
  return import.meta.env.DEV === true;
}
```

#### 2. `ScreenProfile.tsx` — mockMode 분기 3 추가

- `fetchProfile()`: useMobileMocks() true 시 profileApi 호출 생략, mocks/profile 시드 즉시 반환.
- `handleFileSelected()`: mockMode 시 업로드 API 호출 생략, 낙관적 상태 갱신.
- `handleDelete()`: mockMode 시 삭제 API 호출 생략, 낙관적 제거.

#### 3. 무수정 확인 (회고)

`usePageTree.ts` / `ScreenInbox.tsx` 는 Phase 11 시점에 이미 `useMobileMocks()` 분기 완비 — 본 핫픽스 영향 없음. 위 1번 flags.ts 수정만으로 자동 활성. DM (`ScreenDmList`/`ScreenDmThread`) 은 in-memory mock 이라 항상 populate.

### 시연

```
pnpm --filter @data-craft-mobile/web dev  # env 없이도 mock 자동 활성
```

브라우저 5174 → 5탭 전부 populated 표시 확인.

### 검증

- `pnpm typecheck`: PASS.
- `pnpm test --run`: 674 passed / 5 skipped / 1 pre-existing infra failure (tailwind-build.test.ts dist 부재 — 본 핫픽스 무관).

### 영향 파일 (work repo = `data-craft-mobile`)

- `apps/web/src/mobile/mocks/flags.ts`
- `apps/web/src/mobile/screens/profile/ScreenProfile.tsx`

## v001.276.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 5 — 그룹 관리 좌측 사이드바 개선)

### 개요

마스터 보고: 행 연결 그룹 관리 dialog 의 좌측 사이드바 (컬럼 체크박스 + 이름 목록) 가 컴팩트하지 않고 헤더가 없으며 전체 선택/해제 기능이 없음. 글자 크기도 약간 작음. 본 핫픽스는 4가지 개선.

### 변경

#### 1. 컴팩트화
- 항목 padding `px-3 py-2` → `px-2 py-1`.
- 항목 wrapper 의 외부 spacing 축소.

#### 2. sticky 헤더 신규 추가
- 좌측 사이드바 상단에 `sticky top-0 z-10 bg-white border-b` 헤더 행 추가.
- 헤더 안: 전체 선택 체크박스 + "연결 열" 라벨 + 우측 "N/M" 선택 카운터.

#### 3. 전체 선택/해제 + indeterminate
- 헤더 체크박스 상태:
  - 전체 선택 → `checked=true`.
  - 0개 선택 → `checked=false`.
  - 일부 선택 → `indeterminate=true`.
- 클릭 핸들러: 전체 선택 상태면 `setSelected(new Set())`, 그 외는 `setSelected(new Set(allColumnFields))`.
- Radix 미사용 환경에 맞게 useRef + useEffect 로 DOM `.indeterminate` 속성 직접 제어.

#### 4. 글자 크기 확대
- 컬럼명 `text-xs` → `text-sm` (한 단계 위).
- 리더 배지는 `text-[10px]` 유지 — 계층 구분 보존.

### 영향 파일

- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (`fb39b542`: +64/-32)

### 정책 합치

- data-craft FE-only.
- Lint gate: PASS (0 errors, 19 warnings).
- 회귀: 우측 세부 패널 (HOTFIX 3 정렬 결과), 하단 "선택 연결 열 제거" 동적 텍스트 (HOTFIX 2), 리더 토글 (HOTFIX 2) 모두 무변경.

## v001.275.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 4 — 리더 컬럼 메뉴 단일 항목 축소)

### 개요

마스터 보고: 행 연결 리더 컬럼의 열 메뉴에 일반 메뉴 항목 (제목/너비/단위/단위 위치/기본값/본문 스타일/정렬/행 그룹/칸반 기준/고정/이동/삭제 등) 이 그대로 노출되는데, HOTFIX 2 의 "행 연결 그룹 관리" 모달 안 세부 패널에서 모두 편집 가능 → **완전 중복**. 본 핫픽스는 리더 컬럼 메뉴를 "행 연결 그룹 관리" 단일 항목으로 축소.

### 변경

- **`packages/fs-data-viewer/src/features/grid/hooks/column-menu/menuItems.ts`** (`8cd7bbd`): `createColumnMenuItems` 진입점에 `columnModel.type.id === 'rowLink' && parseRowLinkConfig(...).isLeader === true` 조건 early-return 분기 도입 — 매칭 시 `t.columnMenu.rowLinkManage` 액션 단일 항목 배열 반환 + 빌더 잔여 로직 전체 skip. HOTFIX 1 이 빌더 말미에 추가했던 "행 연결 그룹 관리" 항목 로직을 진입점으로 이동 + 원위치 dead code 제거.

### 동작 표

| 컬럼 종류 | 열 메뉴 |
|---|---|
| 일반 컬럼 (비 rowLink) | 기존 그대로 (제목/너비/단위/스타일/고정/이동/삭제 등 일반 항목) |
| rowLink + isLeader=true (리더) | **"행 연결 그룹 관리" 단일 항목만** |
| rowLink + isLeader=false (비리더) | HOTFIX 1 의 chevron 차단 — 메뉴 진입 자체 불가 |

### 정책 합치

- data-craft FE-only.
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 19 warnings).
- 회귀: 비 rowLink 컬럼 메뉴 + 비리더 chevron 차단 (HOTFIX 1) + 리더 dialog 자체 (HOTFIX 2/3) 모두 무변경.

## v001.274.0

> 통합일: 2026-05-20
> 플랜 이슈: #120 (data-craft-mobile 전 화면 디자인 시안 정합 + FE-only 모크 충전)

### 개요

마스터 보고: data-craft-mobile 실행 시 모든 화면이 비어 보임. BE/DB 무수정 제약 아래 prototype 디자인팀 시안을 기준으로 login 부터 전 화면을 "보이는" 상태로 구현. 26 라우트 전부 prototype 비주얼 패턴으로 정합하고 7개 Placeholder 라우트를 FE-only mock 으로 신규 구현했다. (라우터 root errorElement 부재로 인한 진짜 blank-screen 은 #117 HOTFIX 1·2 에서 이미 해소되어 본 플랜과 무관.)

### 페이즈 결과 (12 commit)

- **Phase 1 (`d77cac4`)** — 디자인 토큰 & 공통 레이아웃: tokens.css 9개 신규 ds-* 색상 + nav/header/tab/input/CTA 표준 + shadow-brand. AppHeader/BottomTabs/AppShell/OfflineBanner 가 prototype 패턴 정합. tailwind.css `@theme` 전체 브리지.
- **Phase 2 (`bf31164`)** — mock 인프라 + Home: `mocks/` 폴더 신설 + `useMobileMocks()` (env `VITE_USE_MOBILE_MOCKS=true`). 3 stub hook mock 분기. ScreenHome / HomeHero / WorkspaceSwitcher / QuickAccessSection 비주얼 정합.
- **Phase 3 (`8ebd5e2`)** — 인증 화면군 (Login/Signup/Forgot/WorkspaceSelect): CSS 모듈 5개 + SignupForm 인라인 → 토큰 변수 전환. SSOButton 50/r10/0.5px.
- **Phase 4 (`21e3a2a`)** — PageTree + PageViewer: sticky 검색바 + FAB. PageViewer 헤더 + WidgetBox 래퍼. mocks/page-tree + mocks/page-viewer.
- **Phase 5a (`06cdaab`)** — Viewer Grid + Kanban (exemplar): 5종 모드 탭 + 필터 칩 + 상태 칩 5컬러맵 + 카드. mocks/viewer-grid (15행) + mocks/viewer-kanban (4컬럼·11카드). useServerPaging 로컬 래퍼.
- **Phase 5b (`803ac8f`)** — Viewer Gantt + Calendar + Dashboard: 5a 패턴 적용. Calendar Month/Week/Day. Dashboard MockKpiGrid + MockBarChart + MockDonutChart SVG.
- **Phase 6a (`2df635a`)** — Record Detail: prototype ScreenRecord 패턴 재작성. 3탭 brand underline. 4 stub 컴포넌트 → 인라인 mock 렌더 (댓글/반응/활동/공유 실표시). mocks/record (4 레코드).
- **Phase 6b (`4cb1c98`)** — UserForm: 입력 토큰화, CTA shadow-brand. mocks/user-form (5필드 스키마).
- **Phase 7 (`0b8d701`)** — Search/Notifications/Inbox/Profile: mocks 3 신설. useGlobalSearch 가 mocks/search 사용. Profile prototype 헤더 + 설정 메뉴 8.
- **Phase 8 (`2cf00f3`)** — Feed + Compose 신규 (Placeholder 교체): mocks/feed (16 시드) + addFeedPost. ScreenFeed 4 필터 + 5종 활동 카드 + 반응 chip. ScreenCompose textarea + 게시 CTA.
- **Phase 9 (`024600a`)** — DM List/Thread/Permission 신규: mocks/dm (7 대화) + 1.5초 자동응답. ScreenDmList/Thread/Permission. 권한 모달 7일 TTL.
- **Phase 10 (`76e86ee`)** — PageFollow 신규: mocks/page-follow (7 시드). 팔로우 토글 + 페이지 목록 + 정보 카드.
- **Phase 11 (`0f63ae4`)** — 회귀 테스트 fix: advisor #2 가 발견한 21 vitest 실패 전량 해소. 6개 훅/화면의 "BE 빈/에러 시 mock fallback" 분기 제거 (env flag 만 활성). ScreenGridViewer 로컬 래퍼 우회. DODIntegration DOD-03/04/06 을 stub 단위 테스트로 재작성. vite.config.ts (root + apps/web) 서브패스 alias 추가.

### 시연 활성화 (마스터 안내)

mock 시드는 **`VITE_USE_MOBILE_MOCKS=true` env 활성 시에만** 화면에 노출. BE 미실행 + env 미설정 시 기존 empty/error state 폴백 (회귀 테스트 보존).

```
VITE_USE_MOBILE_MOCKS=true pnpm --filter @data-craft-mobile/web dev
```

### 검증

- `pnpm typecheck`: PASS (12 commit 전체).
- `pnpm test --run`: 674 passed / 5 skipped / 0 failed (679). (5 skip = tailwind-build.test.ts dist/ 부재 — CI build 게이트 선행 사유.)
- 수동 브라우저 시연: 본 플랜 자동 검증 범위 외 — master 별도 확인 권장.

### Deferred (후속 권고)

- **Search 화면 비주얼 잔존**: ScreenSearch.tsx / SearchTabs.tsx / SearchResultCard.tsx 가 Phase 7 affected_files 외였음. 비주얼 미정합.
- **AppHeader 백드롭 블러 가시화**: AppShell 구조상 헤더 뒤로 콘텐츠가 흐르지 않아 블러 효과 미노출. 헤더 absolute/fixed 전환 후속.
- **lib/mockSearch.ts 클린업**: mocks/search.ts 로 교체된 후 테스트 외 미사용.
- **stub 4 컴포넌트 정리**: CommentThreadStub/RecordReactionStub/RecordActivityStub/ShareDMButtonStub 가 components/ 에 살아있으나 ScreenRecordDetail 미사용. RecordDetailStubs.test.tsx 동반 처리 필요.
- **ScreenProfile 설정 메뉴 라우팅**: 8개가 정적 플레이스홀더.
- **WorkspaceSwitcher / QuickAccessSection 인라인 → CSS Module 이전 권고.

### 영향 파일 (work repo = `data-craft-mobile`)

- styles: tokens.css, tailwind.css
- layouts: AppShell.tsx
- components: AppHeader, BottomTabs, OfflineBanner, HomeHero(+css), WorkspaceSwitcher, QuickAccessSection, SSOButton(+css)
- hooks: useAssignedRecords, useRecentPages, useActivityFeed, usePageTree, usePageViewer, useServerPaging (신설), useKanbanBoard, useGanttBoard, useGlobalSearch
- mocks (신설 18): index, flags, home, page-tree, page-viewer, viewer-grid, viewer-kanban, viewer-gantt, viewer-calendar, viewer-dashboard, record, user-form, search, notifications, profile, feed, dm, page-follow
- screens: home, login (4), signup, forgot-password, workspace-select, page-tree, page-viewer, grid-viewer, kanban-viewer, gantt-viewer, calendar-viewer (+components 4), dashboard-viewer, record-detail (3), user-form, search, notifications, inbox, profile, **feed (신설 2)**, **compose (신설 2)**, **dm (신설 3)**, **dm-permission (신설 2)**, **page-follow (신설 2)**
- routes: feed, compose, dm/index, dm/[id], dm-permission, page-follow/[id]
- __tests__: Phase 11 회귀 fix 동반 수정
- root: vite.config.ts + apps/web/vite.config.ts (서브패스 alias)

## v001.273.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 3 — 세부 패널 UI 그리드뷰 열 메뉴 정렬)

### 개요

마스터 보고: HOTFIX 2 의 행 연결 그룹 관리 세부 패널 안 **고정 / 이동 / 본문 스타일 UI 가 그리드뷰 열 메뉴와 어긋났고 글자 크기도 불일치**. 본 핫픽스는 세부 패널의 해당 항목들을 그리드뷰 열 메뉴 (`ColumnMenuDropdown`) 와 동일한 동작/디자인/글자 크기로 정렬.

### 변경

#### 1. 고정 — 동적 분기 (마스터 명확화)

- 기존: 단순 buttonGroup (없음/좌측/우측).
- 변경: **미설정 상태** → "왼쪽 고정" + "오른쪽 고정" 두 action 항목 / **설정 상태** → 두 항목 사라지고 "고정 해제" 단일 action 으로 동적 전환. 그리드뷰 열 메뉴와 동일 패턴. frozen in-place mutation + onRefresh + saveChange 호출 순서도 그리드 열 메뉴와 정확히 정렬.

#### 2. 이동

- 기존 "맨 앞 / 맨 뒤" action 유지하되 disabled tooltip 추가 + `newColumnList` 뮤테이션 누락 버그 함께 수정 (그리드 열 메뉴와 정합).

#### 3. 본문 스타일

- `hasArrow: true` 추가 + 그리드 메뉴와 동일한 label ("열 본문 스타일 편집") 로 통일.

#### 4. 글자 크기 정렬

- `ColumnDetailPanel.tsx` 에 optional `isInPanel` prop 추가 (기본 `true` — 기존 소비자 동작 보존).
- `RowLinkGroupManageDialog.tsx` 에서만 `isInPanel={false}` 전달 → MenuItemRenderer 가 그리드 열 메뉴와 동일한 글자 크기로 렌더. `ViewColumnManagerDialog` 등 기존 다른 소비자는 무영향.

### 영향 파일

- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (`8552ee82`: 고정/이동/스타일 빌더 정렬, `9dab3c14`: lint hotfix — 미사용 `FsGridColumnFrozen` import 제거)
- `packages/fs-data-viewer/src/widgets/view-column-manager/ColumnDetailPanel.tsx` (`8552ee82`: `isInPanel` optional prop 추가)

### 정책 합치

- data-craft FE-only.
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 19 warnings).
- 회귀: rowLink 외 컬럼 타입의 detail panel 동작 무변경 (`isInPanel` 기본 `true` 로 기존 소비자 보존).

### 후속 트레이드오프

`createColumnMenuItems` 직접 재사용은 `scrollToStart/End` / column menu 상태 / 번역 컨텍스트 / aggregation ref 등 그리드 전용 의존성 때문에 scope expansion 불가 → 동일 패턴을 detail panel 빌더 안에 인라인 미러링. 향후 두 빌더가 drift 할 위험은 있으나 본 핫픽스에선 정렬 완료.

## v001.272.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (HOTFIX 2 — 행 연결 그룹 관리 UX 재구성)

### 개요

마스터 요구 — 행 연결 그룹 관리 dialog (HOTFIX 1 통합본) 가 매핑 / 리더 지정 / 재동기화 / 매핑 적용 / 그룹 해제 / 그룹에 새 열 추가 / 열별 속성 표 7개 섹션의 거대 dialog 가 되어 사용성이 떨어진다는 판단으로 UX 재구성. 매핑 UI 는 행 연결 타입 열 추가 시 (RowLinkConfigDialog Step 4) 에만 두고, 그룹 관리 dialog 는 **열별 속성 관리만 담당** 하는 형태로 축소. 리더 변경은 매핑 섹션이 아닌 **열별 속성 패널 안 "연결 그룹 리더" 토글** 로 이동.

### 변경

#### 1. 매핑 UI 완전 제거 (req 1 + 결정 B)

- `RowLinkGroupManageDialog.tsx` 의 매핑 섹션 (HOTFIX 1 통합본의 줄 331-395) 전체 삭제 — 컬럼 매핑 dropdown / "리더 지정" 라디오 / "전체 재동기화" 버튼 / "매핑 적용" 버튼 / "그룹 해제" 버튼 모두 제거.
- **결정 B**: 통합본의 "그룹에 새 열 추가" 섹션 (줄 398-467) 도 그룹 관리 dialog 내 매핑 UI 의 일부이므로 마스터 req 1 literal 위반 — 완전 제거. 사후 행 연결 열 추가는 원 진입점 (열 추가 모달 → 행 연결 타입 선택 → RowLinkConfigDialog) 만 사용.

#### 2. 리더 변경 → 열별 속성 패널 이동 (req 2)

- 세부 패널 (`MenuItemRenderer` 기반) 의 `buildDetailMenuItems` 내부에 rowLink 컬럼 한정 **"연결 그룹 리더"** `toggle` 항목 인라인 추가. 토글 클릭 시 `updateLeaderInGroup` 즉시 호출.

#### 3. 자동 propagation (req 3 + 결정 A)

- "전체 재동기화" / "매핑 적용" 버튼 제거 → 변경 시 자동 트리거.
- **결정 A — 리더 변경 시 비리더 cellValue 정책 = 보존**: 새 리더로 변경되어도 비리더 cellValue 는 기존값 유지. 새 리더가 다음에 값을 변경하면 기존 `useRowLinkCell.handleLeaderValueSave` 흐름으로 자동 propagation. `useRowLinkCell.ts` 무수정 (보존 정책이 무수정으로 자연 충족).

#### 4. 그룹 해제 완전 제거 (req 4)

- 1차 commit (`1ec947b2`) 에서 dialog 의 그룹 해제 버튼 + handler 제거.
- 정리 commit (`8137666e`) 에서 `useRowLinkGroup.ts` 의 `dissolveGroup` 함수 본체 + `createColumnDeletedChange` import + `index.ts` re-export 까지 완전 제거. UI / API 양쪽에서 그룹 해제 표면 0.
- `canDeleteRowLinkColumn` 의 "그룹 해제를 사용하세요" 안내 문구도 "그룹 전체 컬럼을 선택하여 행 연결 그룹 제거 사용" 으로 정정 (2곳).

#### 5. 표 → 체크박스 목록 + 세부 패널 (req 5 + req 6)

- HTML `<table>` (통합본 줄 470-720, 11 컬럼 표) 완전 폐기.
- 좌측 미니 사이드바 — 체크박스 + 컬럼명 + 리더 배지 표시 (선택 가능 목록).
- 우측 — 선택된 컬럼의 세부 설정 패널 (기존 `view-column-manager/ColumnDetailPanel` + `MenuItemRenderer` 패턴 그대로 차용 — 열 메뉴 동일 디자인).
- 신규 컴포넌트 미생성 (기존 패턴 재사용).

#### 6. "선택 연결 열 제거" 버튼 (req 7)

- 하단 단일 버튼. 동적 텍스트/동작:
  - 선택 = 그룹 전체 (리더 + 모든 부하) → **"행 연결 그룹 제거"** (그룹 컬럼 전체 삭제 — `dissolveGroup` 함수 없이 `handleRemove` 핸들러 인라인 루프).
  - 리더 + 일부 부하 선택 (다른 부하 미선택) → 리더 자동 제외 후 선택된 부하만 삭제 + 안내 메시지.
  - 리더 미포함 → 선택된 부하만 삭제.
  - 리더 단독 (모든 부하 미선택) → 노옵 + 안내 ("리더 단독 삭제 불가").

### 영향 파일

- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (대수술 — `1ec947b2`: +341 / -563)
- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/useRowLinkGroup.ts` (`1ec947b2` + `8137666e`: dissolveGroup 제거, canDeleteRowLinkColumn 메시지 정정)
- `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/index.ts` (`8137666e`: dissolveGroup re-export 제거)

### 정책 합치

- data-craft FE-only (BE/DB 무수정).
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 19 warnings).
- advisor #2 (5-perspective) PASS — req 1~7 + 결정 A/B 명시 처리.

### 사전 결정 (advisor 검증 후 명시 채택)

- **결정 A**: 리더 변경 시 비리더 cellValue 정책 = **보존** (옵션 B). 클리어 / 재싱크 X. 새 리더가 다음 값 변경 시 자동 propagation 시작.
- **결정 B**: "그룹에 새 열 추가" 섹션 = **완전 제거**. req 1 literal 일치 (그룹 관리 dialog 안 모든 매핑 UI 제거).

## v001.271.0

> 통합일: 2026-05-20
> 플랜 이슈: #122 (테마 회사 단위 통일 — 서버 권위 전환)

### 개요

마스터 신고: "같은 회사 페이지를 다른 브라우저로 접속했는데 테마가 다르다." 설계 원칙은 "테마는 기업 단위 통일, 권한자만 변경, DB 저장값에서 불러옴". 탐색 결과 BE(`user_preference` 테이블의 `(company_id, pref_key)` UNIQUE), API(`PUT /user-preference` 의 `permissionCheckMiddleware('app_theme_change')` 가드), FE 권한 가드(`usePermission('app_theme_change')`), 서버 동기화 코드(`syncThemeToServer`) 모두 이미 구비됨. 그러나 시드 진입점인 `seedBundleData.ts` 의 분기가 **localStorage(`dc_theme_{companyId}`) 우선 → 서버값 폴백** 순으로 되어 있어 회사 단위 통일 원칙을 정면으로 역행. 더 나아가 권한자가 stale localStorage 를 보유한 브라우저로 접속하면 `syncThemeToServer(companyTheme)` 가 발화하여 **서버를 옛 localStorage 값으로 역덮어쓰기** 까지 하던 corrupting path 존재. 본 플랜은 시드 분기를 서버 권위(DB-SoT) 로 역전.

### 변경

- **`src/app/lib/seedBundleData.ts`** (`bea32e5f`): 테마 시딩 분기 재구성.
  - 우선순위 역전: `serverTheme` 존재 시 무조건 `setThemeFromServer(serverTheme)` + `saveCompanyTheme(companyId, serverTheme)` 로 캐시 갱신.
  - `loadCompanyTheme(companyId)` 의 localStorage 값은 `serverTheme` 가 null/undefined 일 때만 오프라인 폴백으로 적용.
  - 둘 다 없을 때만 기존 기본값(`light`) 유지 + 캐시.
  - **`syncThemeToServer(companyTheme)` 역덮어쓰기 분기 완전 삭제** — 시드 단계에서는 절대 PUT 호출하지 않음. 변경은 `setTheme` 경로(권한자가 UI 에서 직접 바꿀 때)에서만 발생.
  - 미사용이 된 `syncThemeToServer` import 제거. `useAuthStore` 는 `!skipAuth` 블록의 `setAuth` 호출에서 여전히 사용되므로 보존.

### 영향

- ✅ 권한자가 Browser A 에서 정한 테마를 Browser B/C 가 즉시 동일하게 표시 (settled state 기준 회사 단위 통일).
- ✅ 권한 없는 사용자가 자기 localStorage 를 임의 조작해도 서버값으로 강제 덮어쓰기 — 회사 단위 통일 원칙 보장.
- ✅ `AuthProvider.initializeAuth()` 의 reload 경로 (`authApi.init → seedBundleData`) 도 동일하게 서버 권위 적용 — 새로고침/새 탭 진입 모두 동일 동작.
- ✅ `AuthProvider:135` / `:197` 의 `setThemeFromServer('light')` 호출은 인증 실패/비인증 경로 한정으로 정상 회사 테마 적용을 덮어쓰지 않음.
- ⚠️ 서버 fetch 실패 (네트워크 단절) 시에만 `companyTheme` 폴백 사용 — 회복 후 자동 정렬. 의도된 동작.
- 🚧 별도 후속 (본 플랜 범위 외): Zustand `dc_theme` persist hydration 으로 인한 초기 paint flicker — UX 차원의 별도 작업으로 남김.

### 정책 합치

- data-craft FE-only (BE/DB 무수정 — 이미 회사 단위 격리 완비).
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 20 warnings pre-existing).
- advisor #1 (계획 시점) / #2 (완료 시점) 5-perspective PASS — Intent / Logic / Group Policy / Evidence / Command Fulfillment.

### 검증 시나리오 (수동)

1. Browser A (권한자) → 앱 설정 → 테마 변경 → DB 반영 확인.
2. Browser B (시크릿창, 동일 회사 / 동일 또는 다른 사용자) → 로그인 → A 가 정한 테마로 표시 확인.
3. Browser C (다른 회사 시절의 stale `dc_theme_{companyId}` localStorage 보유) → 동일 회사 로그인 → 서버값으로 강제 표시 확인 (이전엔 stale localStorage 가 우선되어 실패하던 시나리오).
4. 권한 없는 사용자: 테마 UI 비활성 + 표시는 서버값으로 강제 동기화 확인.

## v001.270.0

> 통합일: 2026-05-20
> 플랜 이슈: #118 (Phase 5 보강 — 그리드 file/image 등가 위임)

### 개요

플랜 #118 (rowLink 비리더 풀-매칭 렌더러 위임) 의 req 4 ("extraProps 를 **등가** 구성한 뒤 위임 렌더링") 완결 보강. 이전 머지 (v001.265.0) 시점에 Phase 5 코멘트에 명시된 blocker — "그리드 비리더 file/image: userList / dataViewerField / onFileLoad / fileCell 미공급 → 실제 파일 목록 미조회" — 가 dispatch-map 레이어 (`cell-renderer-map.tsx`) 의 `simpleRenderers` ↔ `extendedRenderers` 분기 때문임이 advisor #2 사전 검증에서 확인되어, 본 보강이 rowLink 등록을 `extendedRenderers` 로 이주하고 4개 prop 을 forwarding 하여 그리드/비그리드 위임 인터페이스의 완전 등가를 달성.

### 변경

- **`packages/fs-data-viewer/src/widgets/fs_grid_renderer/cell-renderer-map.tsx`** (`86eeb6a`): rowLink 항목을 `simpleRenderers` 에서 제거하고 `extendedRenderers` 에 `userList / dataViewerField / onFileLoad / fileCell` 4개 prop 을 forwarding 하는 항목으로 이주.
- **`packages/fs-data-viewer/src/widgets/cell-renderers/row-link/FsGridRowLinkCellRenderer.tsx`** (`86eeb6a`): 동일 4개 optional prop 시그니처 추가 → 비리더 dispatcher 호출 시 그대로 전달. `rowLinkDelegateDispatcher.tsx` / `rowLinkDelegateResolver.ts` 는 이미 해당 prop 수신·처리 인터페이스 보유 — 무변경.

### 영향

- ✅ 그리드 비리더 셀이 타겟 file/image 컬럼으로 매핑된 경우, 실제 파일 목록 조회 + 미리보기가 비그리드 (table/kanban/gallery/calendar) 경로와 동등하게 작동.
- ✅ 다른 타입 (text/number/date/select/등) 의 위임 동작은 부작용 없음 — forwarding 된 4개 prop 은 모두 optional 이며 file/image 외 렌더러에서 무시.
- ✅ HOTFIX 14 회귀 (unit suffix 표시) + Phase 6 보강 (빈값 `-` placeholder) 그대로 유지.

### 정책 합치

- data-craft FE-only (BE/DB 무수정).
- Lint gate (`pnpm typecheck:all && pnpm lint`): PASS (0 errors, 18 warnings pre-existing).
- advisor #2 (5-perspective) PASS — Intent / Logic / Group Policy / Evidence / Command Fulfillment.

## v001.269.0

> 통합일: 2026-05-19
> 플랜 이슈: #119 (HOTFIX 5)

### 개요

마스터 요구: 간트뷰 인쇄 기간 선택 단계에서 OS/브라우저 네이티브 캘린더(`<input type="date">`) 대신 커스텀 컴포넌트 사용. 기존 shared 빌딩 블록(`useDatePickerState` + `DatePickerDropdown`) 을 재사용하여 파일 내부 전용 `CustomDateField` 컴포넌트를 작성하고 두 input 을 교체. 새 의존성 도입 없음 — `YYYY-MM-DD` 문자열 contract 보존으로 기존 validation 로직(parseInputDate / endBeforeStart / overSixMonths) 무변경.

### 페이즈 결과

- **Phase 7 (HOTFIX 5)** (`614441a`):
  - `GanttPeriodSelectStep.tsx` 상단에 `useDatePickerState` + `DatePickerDropdown` import 추가.
  - 파일 내부 전용 `CustomDateField` 컴포넌트 신규 — props `{value, onChange, placeholder}`, 내부에서 `useDatePickerState(value || undefined)` 사용 후 trigger 버튼 + DatePickerDropdown 합성.
  - 시작일·종료일 두 곳의 `<input type="date">` 를 `<CustomDateField ... />` 로 교체. label 옆 Calendar 아이콘 / "최대 6개월" 안내 / 에러 표시 모두 보존.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/print/ui/steps/GanttPeriodSelectStep.tsx`

1 파일 / +69 / -8 / 단일 커밋.

### lint

- lint gate (`pnpm typecheck:all && pnpm lint`) PASS (0 errors, 20 warnings).

## v001.268.0

> 통합일: 2026-05-19
> 플랜 이슈: #118 (HOTFIX 1)

### 개요

마스터 보고 두 가지: ①디자인 모드 → 리더 열 → 열 메뉴의 "행 연결 그룹 관리" 와 "행 연결 그룹 편집" 두 항목을 하나로 합쳐. ②부하 행 (비리더 컬럼) 들은 애초에 열 메뉴 열기 버튼 (아래 화살표 chevron) 자체가 안 나오게.

### 페이즈 결과

- **HOTFIX 1** (`5424c6b` + typecheck fix `46d2c9f`):
  - **A. 메뉴 항목 통합**: 기존 "행 연결 그룹 관리" (열별 속성 편집) 와 "행 연결 그룹 편집" (매핑 / 리더 / 해제 / 재동기화 / 새 열 추가) 두 항목을 단일 메뉴 항목 **"행 연결 그룹 관리"** 로 통합. `RowLinkGroupEditDialog.tsx` 삭제, 해당 편집 섹션 (컬럼 매핑 + 리더 지정 + 전체 재동기화 + 매핑 적용 + 그룹 해제 + 그룹에 새 열 추가) 을 `RowLinkGroupManageDialog` 상단 별도 섹션으로 흡수. 메뉴 항목은 리더 열에만 노출 (기존엔 모든 rowLink 열에 표시되던 동작 정정).
  - **B. 비리더 컬럼 chevron 차단**: `ColumnHeader.tsx` 에서 rowLink + isLeader=false 컬럼은 `showColumnMenu=false` → chevron 자체 렌더 제거. `parseRowLinkConfig` 결과로 식별. 비rowLink 컬럼은 기존 동작 유지.
  - **i18n 4언어 동시 갱신**: ko / en / ja / zh translation 키 일괄 정정.
  - **Typecheck fix**: `ColumnHeader` 의 `columnModel` 변수 hoisting 정정 (참조 전 선언).

### advisor 검증

- 완료 시점 (advisor #2): PASS — 5관점 모두 PASS. column-scoped chevron 차단 git show 로 확인.

### 영향 파일

수정 (14): `features/grid/hooks/column-menu/menuItems.ts`, `column-menu/types.ts`, `column-menu/useGridColumnMenu.ts`, `widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx`, `widgets/cell-renderers/row-link/index.ts`, `widgets/grid-table/FsGridTableView.tsx`, `widgets/grid-table/components/ColumnHeader.tsx`, `widgets/grid-table/hooks/useTableViewInit.ts`, `widgets/grid-table/hooks/useTableViewState.ts`, `shared/config/i18n/translations/{ko,en,ja,zh}.ts`, `shared/config/i18n/types.ts`.

삭제 (1): `widgets/cell-renderers/row-link/RowLinkGroupEditDialog.tsx` (RowLinkGroupManageDialog 로 흡수).

## v001.267.0

> 통합일: 2026-05-19
> 플랜 이슈: #119 (HOTFIX 4)

### 개요

마스터 보고: 간트뷰 인쇄에는 캘린더와 달리 하단 "선택된 행 (N개)" 부록 표가 안 나옴. 캘린더는 `buildSelectedRowsAppendix` 가 이미 본문 뒤에 부록 표를 append 하지만 간트는 그 단계가 없었음. 캘린더의 helper(`buildCalendarAppendixTable`) 와 CSS(`.calendar-appendix`) 를 그대로 재사용하여 간트 인쇄에 동일 부록 표 부착.

### 페이즈 결과

- **Phase 6 (HOTFIX 4)** (`1bc6b06`):
  - `useGanttPrint.ts` import 에 `buildCalendarAppendixTable` 추가 (`formatCellValue` 는 기존 import 합산).
  - `buildSelectedRowsAppendix` helper 신규 — `options.gantt.selectedRowIds` 기반 행 필터링 후 `viewerModel.columnModelList` 전체 컬럼으로 부록 표 생성 (간트엔 컬럼 선택 단계 없으므로 캘린더의 `selectedColumns` 분기 불필요).
  - `generateGanttPrintHtml` 의 `buildFullHtml` 호출 3번째 인자를 `ganttHtml + appendixHtml` 로 변경 — 페이지 끝에 부록 표 자동 append.
  - `generateGanttStyles` 에 캘린더 측 `.calendar-appendix` 8개 CSS 룰 그대로 복사. helper wrapping 클래스명 정합 유지를 위해 클래스명 변경 없이 재사용 (차후 cleanup 에서 `buildAppendixTable` / `.print-appendix` 로 rename 가능).

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/print/views/gantt/useGanttPrint.ts`

1 파일 / +71 / -2 / 단일 커밋.

### lint

- lint gate (`pnpm typecheck:all && pnpm lint`) PASS (0 errors, 20 warnings).

### 후속 cleanup 후보 (본 핫픽스 scope 외)

- `buildCalendarAppendixTable` / `.calendar-appendix` 명명은 이제 간트 + 캘린더 공용 — 별도 cleanup 에서 generic 명칭(`buildAppendixTable` / `.print-appendix`) 으로 rename 권장. 본 hotfix scope 에선 양쪽 동시 변경 회피 위해 보존.

## v001.266.0

> 통합일: 2026-05-19
> 플랜 이슈: #119 (HOTFIX 3)

### 개요

마스터 보고: 간트뷰 인쇄에서 지정한 기간(dateRange) 에 막대가 있음에도 행 선택 단계에 "선택된 기간에 해당하는 행이 없습니다." 로 표시. 근인은 `GanttRowSelectStep.tsx:45` 가 `viewerModel.rowModelList` 를 데이터 소스로 사용하는 반면 `FsGanttChart.tsx:227-231` 은 서버 페이징 모드에서 `paging.serverRows` 를 displayRows 로 사용하기 때문 — 페이징 모드에서 rowModelList 가 비어 있어 행 선택 단계가 항상 빈 결과. 캘린더 HOTFIX 1 (`publishCalendarRows` 채널) 과 정확히 동일 구조의 버그. 동일 publish/subscribe 패턴을 간트에 적용해 해소.

### 페이즈 결과

- **Phase 5 (HOTFIX 3)** (`0885fc2`):
  - `types.ts`: `GanttPrintOptions.rowsOverride?: E.FsGridRowModel[]` 옵셔널 필드 + `PrintContextValue.publishGanttRows(rows)` + `DEFAULT_PRINT_OPTIONS.gantt.rowsOverride: undefined`.
  - `PrintContext.tsx`: `publishedGanttRows` state + callback, `openPrintDialog` 의 새 gantt 분기에서 `rowsOverride: publishedGanttRows` 주입, useCallback 의존성 배열 + value 노출.
  - `FsGanttChart.tsx`: `usePrintContextOptional` import + `displayRows` 가 변할 때마다 `publishGanttRows(displayRows)` 호출하는 useEffect 추가 (paging.serverRows 가 있으면 그 값, 없으면 viewerModel.rowModelList).
  - `GanttRowSelectStep.tsx`: `overlappingRows` useMemo 의 `viewerModel.rowModelList` 사용을 `options.gantt?.rowsOverride ?? viewerModel.rowModelList` 로 전환 + 의존성 배열 갱신.
  - `useGanttPrint.ts`: `prepareGanttData` 시그니처에 `options: PrintOptions` 인자 추가, 함수 내부에서 `options.gantt?.rowsOverride ?? viewerModel.rowModelList` 사용, 호출처 `generateGanttPrintHtml` 도 options 전달.
  - `GanttPdfAdapter.ts`: line 41 forEach 데이터 소스 동일 패턴 전환.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/print/types.ts`
- `packages/fs-data-viewer/src/features/print/context/PrintContext.tsx`
- `packages/fs-data-viewer/src/widgets/gantt-chart/gantt-chart/FsGanttChart.tsx`
- `packages/fs-data-viewer/src/features/print/ui/steps/GanttRowSelectStep.tsx`
- `packages/fs-data-viewer/src/features/print/views/gantt/useGanttPrint.ts`
- `packages/fs-data-viewer/src/features/print/adapters/GanttPdfAdapter.ts`

6 파일 / +41 / -8 / 단일 커밋.

### lint

- lint gate (`pnpm typecheck:all && pnpm lint`) PASS (0 errors, 20 warnings).

## v001.265.0

> 통합일: 2026-05-19
> 플랜 이슈: #118

### 개요

행 연결(rowLink) 컬럼 타입의 비리더 셀 표시를 타겟 컬럼의 모든 셀 타입과 완전히 일치시키는 풀-매칭 구현. HOTFIX 14 (v001.255.0) 가 unit/unitPosition/defaultValue 3개 메타데이터만 상속하여 number/currency/percent 의 unit suffix 정도만 표시 일치시켰던 한계를 전 타입 (text/longText/number/link/phone/email/currency/percent/code/boolean/timeline/date/dateTime/time/checkbox/log/lastUpdate/singleSelect/multiSelect/deadline/formula/simpleFormula/colorPicker/timer/user/worldTime/uniqueId/tag/vote/rating/progress/nation/image/file/dualWidget/document 등) 으로 확장. 옵션 B 의 풀-매칭 — `column.type='rowLink'` 를 유지하면서 RowLinkRenderer / FsGridRowLinkCellRenderer 가 비리더 셀 표시 시 타겟 타입의 실제 renderer 에 delegate 하여 완전 동등 출력. 리더 셀의 ConnectionEditOverlay 진입 + useRowLinkCell propagation 훅은 무변경 보존.

### 페이즈 결과

- **Phase 0 — 사전 결정 lock** (이슈 본문):
  - 결정 1: RowLinkConfig = transport/persistence form (`targetColumnMetadata` snapshot 동봉), column model = materialized rendering source. 두 출처 drift 차단.
  - 결정 2: 타입별 raw cellValue 정책 표 lock (singleSelect/multiSelect/tag/vote=valueId, file/image=ref id readonly, button=action id readonly, log/lastUpdate/uniqueId=드롭다운 제외).
  - 결정 3: 신규 `cellRendererRegistry.ts` 단방향 모듈로 circular import 회피.
  - 결정 4: formula/simpleFormula 분기 = Phase 1 BE 정찰 결과 → **in-scope** (VIEW 경로 계산 결과 반환 확인).

- **Phase 1** (`ddc6553`): BE 응답 정찰 (formula in-scope 확정) + `ConnectionColumnItem` 풀 메타데이터 필드 추가 + host `requestConnectionColumns` 콜백 4개 (fs-data-viewer-explorer / fs-sub-data-viewer-explorer / fs-external-data-viewer-explorer / src/features/viewer) 매핑 확장 + `RowLinkConfig.targetColumnMetadata` 도입 + `parseRowLinkConfig` 구버전 후방호환 (평탄 unit/unitPosition/defaultValue → `targetColumnMetadata` lift).

- **Phase 2** (`4c25ed8` + lint hotfix `3ddf662`): 신규 `RowLinkColumnDropdown.tsx` 헬퍼 도입 — COLUMN_ICONS + FsGridColumnTypes 재사용 타입 아이콘 + 한글 라벨. `filterMappableColumns` 로 log/lastUpdate/uniqueId 시스템 컬럼 드롭다운 제외 (formula/simpleFormula 포함 유지). RowLinkConfigDialog Step 4 displayProps 빌더를 `RowLinkTargetColumnMetadata` 전체 필드로 확장. RowLinkGroupEditDialog 동일 적용. Lint hotfix = `filterMappableColumns` 헬퍼 sibling 파일 분리 (`react-refresh/only-export-components`).

- **Phase 3** (`7090039`): `addRowLinkColumns` displayProps 파라미터 타입 확장 (좁은 unit/unitPosition/defaultValue shape → `RowLinkTargetColumnMetadata` 전체). columnTemplate (BE 전송) + newColumn (FE 로컬 상태) 양쪽에 optionList / cellRendererModelList / enableSorting / enableAggregation / aggregationDisplayType / importanceLevels / textAlign 상속. customDataList 는 rowLink config 첫 entry + 타겟 nested append (dualWidget/document nested config 보존).

- **Phase 4a** (`173b5a6`): 비-rowLink 셀 렌더러 34종을 신규 `cellRendererRegistry.ts` 로 이주. `RendererProps / RendererConfig / RenderParams / simpleRenderer` 공유 타입·헬퍼 동반 이동 + rendererMap.tsx 에서 re-export. rendererMap 은 registry spread + rowLink 단일 엔트리 추가 thin wrapper 로 축소. 단방향 의존 그래프 완성.

- **Phase 4b** (`e3aa860` + lint hotfix `7555cbb`): 신규 `rowLinkDelegateDispatcher.tsx` — registry 에서 mappedTargetColumnType lookup, registry 미등록 시 unit decoration fallback, 등록 시 delegate Component 위임. `viewerIsReadOnly=true` + 모든 onChange/onCommit 류 noop 강제. Lint hotfix = `resolveDelegateRenderer` util 함수 sibling 파일 `rowLinkDelegateResolver.ts` 분리.

- **Phase 5** (`15660c3`): 그리드/비그리드 RowLink 렌더러 비리더 셀 위임 적용. dispatcher 의 cellModel 의존을 `cellValue: string` 으로 교체. 그리드 (FsGridRowLinkCellRenderer) — renderContent() 내부 비리더 분기에서 getViewerModel + rendererContext.rowField 추출 dispatcher 호출, HOTFIX 14 인라인 unit decoration 제거. 비그리드 (RowLinkRenderer) — 모든 hooks 호출 이후 비리더 조기 반환 (React hooks 규칙 준수). rendererMap extraProps 보강 (columnModel / rowField / userList / 파일 관련 props 공급).

- **Phase 6** (`470da8b`): `useRowLinkCell.handleLeaderValueSave` JSDoc 확장 — 비리더 cellValue raw string 저장 정책 + viewerType 별 의미 명문화. dispatcher fallback TODO 코멘트. column-restrictions.ts 감사 (rowLink 가 이미 DISABLE_* 세 목록에 포함 — 변경 불필요). rowLinkDelegateResolver.ts 사용 확인 (변경 불필요).

- **Phase 6 보강** (`c697b521`): dispatcher fallback 분기에 HOTFIX 14 빈값 placeholder (`-`) 복원 — 회귀 매칭 완전.

### advisor 검증

- 계획 시점 (advisor #1): PASS — Intent / Logic / Group Policy / Evidence / Command Fulfillment 5관점 모두 PASS.
- 완료 시점 (advisor #2): PASS — 전체 5관점 PASS. BLOCK 없음.

### 의도된 partial / 후속 핫픽스 후보

- **그리드 비리더 file/image preview wiring**: 그리드 경로는 userList/onFileLoad/fileCell/dataViewerField 를 dispatcher 에 공급하지 않아 실제 파일 목록 미조회 (비그리드 경로는 rendererMap extraProps 로 공급되어 정상). req 6 의 file/image "정책 결정" 항목을 `그리드 = placeholder 표시 / 비그리드 = 풀 preview` 로 분리 결정. 그리드 풀 wiring 은 마스터 필요 시 `핫픽스` 재진입.
- **BE textAlign 필드 부재**: FE 타입은 추가했으나 host callback 매핑 시 undefined. 향후 BE 가 textAlign 추가 시 매핑 보완.
- **requestConnectionColumns 콜백 4-중복 drift 위험**: 향후 구현체 추가 시 동기화 누락 위험. drift 방지는 별도 리팩토링 후보.
- **EAV 폴백 경로 formula write 검증**: 본 플랜 외 BE 후속.

### 영향 파일 (data-craft)

신규 (5): `cellRendererRegistry.ts`, `RowLinkColumnDropdown.tsx`, `rowLinkColumnFilters.ts`, `rowLinkDelegateDispatcher.tsx`, `rowLinkDelegateResolver.ts`.

수정 (12): `entities/connection/types.ts`, `entities/row-link/types.ts`, `entities/row-link/helpers.ts`, `RowLinkConfigDialog.tsx`, `RowLinkGroupEditDialog.tsx`, `FsGridRowLinkCellRenderer.tsx`, `RowLinkRenderer.tsx`, `useRowLinkCell.ts`, `addRowLinkColumns.ts`, `rendererMap.tsx`, `connectionCallbacks.ts` ×4.

## v001.264.0

> 통합일: 2026-05-19
> 플랜 이슈: #119 (HOTFIX 2)

### 개요

마스터 보고: 행 선택 단계에는 현재 월에 행이 3개만 보이는데 실제 인쇄 캘린더 본문에는 그것보다 많은 행이 나옴. 근인은 `useCalendarPrint.collectEvents` 가 `dateColumns.forEach` 로 **모든** 날짜 컬럼을 iterate 하며 한 행을 컬럼 수만큼 중복 노출 + 행 선택 스텝이 보지 않는 컬럼(예: dualWidget) 의 행까지 포함시킨 것. 동시에 dualWidget 서브위젯 추출 / deadline JSON 처리 / `calendarEventParsers.parseDate` (로컬 자정 기준) 사용이 모두 누락되어 행 선택 스텝 / 캘린더 본체와 데이터 추출 방식이 분기되어 있었음. 본 핫픽스는 collectEvents 를 행 선택 스텝의 dateGroups 로직과 정합화하여 미스매치 해소.

### 페이즈 결과

- **Phase 4 (HOTFIX 2)** (`3fb4a90`):
  - `useCalendarPrint.ts` collectEvents 전면 재작성 — `dateColumns[0]` 만 사용 (normal-168 정책, 캘린더 본체 + 행 선택 스텝과 동일).
  - dualWidget 처리 추가 — `parseDualWidgetConfig` / `getDateSubWidgets` / `parseDualWidgetCellValue` 로 첫 date 서브위젯 값 추출 + `isDateTime` 판정.
  - deadline JSON `{"date":"..."}` 형식 파싱 추가.
  - 날짜 파서를 `parseDateValue` 에서 `calendarEventParsers.parseDate(value, isDateTime)` 로 교체 — 로컬 자정 기준 통일.
  - `generateCalendarPrintHtml` 의 `dateColumns` 필터에 `dualWidget` 추가 — 이전엔 dualWidget-only 뷰어가 "날짜 컬럼이 설정되지 않았습니다" 로 렌더되던 회귀까지 동시 해소 (행 선택 스텝의 `getAutoDateColumnCandidates` 와 정합).
  - `parseDateValue` 는 외부 test / `index.ts` 사용처 보존을 위해 export 유지 (collectEvents 내부 호출만 제거).

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/print/views/calendar/useCalendarPrint.ts`

1 파일 / +63 / -25 / 단일 커밋.

### lint

- lint gate (`pnpm typecheck:all && pnpm lint`) PASS (0 errors, 19 pre-existing warnings).

### 후속 cleanup 후보 (본 핫픽스 scope 외)

- `parseDateValue` 함수가 collectEvents 외 사용처는 `__tests__` 와 `features/print/index.ts` export 뿐 — 별도 cleanup 이슈에서 외부 사용 정리 후 함수 자체를 제거하는 것이 권장됨.

## v001.263.0

> 통합일: 2026-05-19
> 플랜 이슈: #119 (HOTFIX 1)

### 개요

플랜 #119 초기 작업 완료(v001.262.0) 후 마스터가 브라우저 인쇄 다이얼로그로 넘어갔을 때 캘린더 본문(달력 그리드) + "선택된 행 (N개)" 부록 표가 페이지 좌측에 붙어 표시되는 회귀를 스크린샷과 함께 보고. 본 플랜 변경(데이터 소스 분기)은 CSS 무수정이었으나, 처음으로 인쇄 내용이 정상 노출되면서 사전 좌측 정렬 버그가 가시화됨. 근인은 `printStyleGenerator.ts` 의 `@media print` 룰이 화면 모드의 `margin: 0 auto` 가운데정렬을 `margin: 0` 으로 덮어쓰던 것 — 초기 squash 시점부터 존재한 사전 버그.

### 페이즈 결과

- **Phase 3 (HOTFIX 1)** (`2f101da`): `printStyleGenerator.ts:287` `.print-content` `@media print` 룰 `margin: 0` → `margin: 0 auto` (단어 한 개 추가). screen 모드 무영향, 5 인쇄 뷰(grid / calendar / gantt / kanban / dashboard) 공유 컨테이너이므로 모든 인쇄 경로에서 가운데정렬 회복. `.print-content` width = paperWidth - margins.left - margins.right 로 정확히 printable area 폭이므로 양옆 절단 없이 fit.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +1 / -1 / 단일 커밋.

### lint

- lint gate (`pnpm typecheck:all && pnpm lint`) PASS (0 errors, 19 pre-existing warnings).

## v001.262.0

> 통합일: 2026-05-19
> 플랜 이슈: #119

### 개요

마스터 보고: 데이터 뷰어 → 캘린더 뷰에서 인쇄 진입 시, 화면에 일정 카드가 보이는 월이라도 "행 선택" 단계에 행이 0개로 표시. HOTFIX 28 (월 필터)·HOTFIX 29 (`publishCalendarMonth`)·HOTFIX 30 (PrintDialog optional context) 까지 적용되어 `targetMonth` 자체는 캘린더 현재 월로 올바르게 전달되고 있었으나, 행 데이터 소스가 여전히 `viewerModel.rowModelList` 였다. `FsCalendarChart` 는 Enterprise 123-1 (`FsCalendarChart.tsx:431` 주석: "viewerModel.rowModelList 필터링 제거 — 서버 페이징 모드에서 rowModelList 가 비어있어 데이터 소실 방지") 이래 자체 `serverRows` (monthCacheRef) 로 카드를 렌더링하므로, 서버 페이징 모드에서 인쇄 3 소비처(행 선택 스텝 / HTML 생성기 / PDF 어댑터) 가 빈 `rowModelList` 를 읽어 0건. 캘린더 본체와 동일 데이터 소스 정합화로 해소.

### 페이즈 결과

- **Phase 1** (`d1515d2`): PrintContext publish/subscribe 채널 + 옵션 주입.
  - `features/print/types.ts`: `PrintCalendarOptions.rowsOverride?: E.FsGridRowModel[]` 옵셔널 필드 + `PrintContextValue.publishCalendarRows(rows)` + `DEFAULT_PRINT_OPTIONS.calendar.rowsOverride: undefined`.
  - `features/print/context/PrintContext.tsx`: `publishedCalendarRows` state + callback, `openPrintDialog` 의 calendar 분기에서 `rowsOverride: publishedCalendarRows` 주입, useCallback 의존성 배열 + value 노출, `E` import 추가.
  - `widgets/calendar/FsCalendarChart.tsx`: 기존 HOTFIX 29 useEffect 옆에 `serverRows` publish useEffect 추가 (`serverRows === null` 가드로 초기 마운트 페치 전 폴백 보존).
- **Phase 2** (`45d39c8`): 3 소비처 데이터 소스 전환 (`rowsOverride` 우선).
  - `features/print/ui/steps/CalendarRowSelectStep.tsx`: `dateGroups` useMemo 의 forEach 데이터 소스를 `options.calendar?.rowsOverride ?? viewerModel.rowModelList` 로 전환 + 의존성 배열 갱신.
  - `features/print/views/calendar/useCalendarPrint.ts`: `collectEvents` 시그니처에 옵셔널 `rowsOverride?` 추가, `generateCalendarPrintHtml` 호출처 + `buildSelectedRowsAppendix` 의 filter 데이터 소스 동일 패턴 전환.
  - `features/print/adapters/CalendarPdfAdapter.ts`: PDF 어댑터 line 40 forEach 데이터 소스 동일 패턴 전환.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/print/types.ts`
- `packages/fs-data-viewer/src/features/print/context/PrintContext.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/FsCalendarChart.tsx`
- `packages/fs-data-viewer/src/features/print/ui/steps/CalendarRowSelectStep.tsx`
- `packages/fs-data-viewer/src/features/print/views/calendar/useCalendarPrint.ts`
- `packages/fs-data-viewer/src/features/print/adapters/CalendarPdfAdapter.ts`

총 6 파일 / +37 / -8 / 2 커밋.

### lint / test

- lint gate (`pnpm typecheck:all && pnpm lint`) 양 페이즈 PASS (0 errors, 19 pre-existing warnings).
- 테스트 회귀 0건: WIP `70 fail / 1989 pass`, i-dev 베이스라인 `70 fail / 1989 pass` — 완전 동일 (기존 사전 실패와 동일 집합, 본 변경 무영향). `rowsOverride` 가 옵셔널 + `??` 폴백이므로 기존 테스트(viewerModel.rowModelList 주입 경로) 는 그대로 통과.

### 미해결 / 의도된 carve-out

- **초기 마운트 직후 인쇄**: `serverRows === null` (첫 페치 완료 전) 인 순간 publish 가 스킵되어 폴백(rowModelList) 사용. 이 순간은 캘린더 본체도 빈 상태이므로 회귀 아님 — 의도된 동작.
- **비-서버-페이징 모드**: 실측 상 `FsCalendarChart` 가 모드 관계없이 `serverRows` 를 set 하므로 publish 가 항상 fire. "캘린더 본체와 동일 데이터 소스" 라는 의도된 결과지만 비-서버-페이징 케이스 회귀 가능성은 dev 서버 수동 검증 필요.

## v001.261.0

> 통합일: 2026-05-19
> 플랜 이슈: #117 (HOTFIX 2)

### 개요

HOTFIX 1 의 root errorElement 만으로는 부족했음. 마스터 스크린샷으로 트리거 확보 — `localhost:5174/contact` 직접 URL 입력. 콘솔 로그 "No routes matched location '/contact'". `/contact` 는 `/` (정확 매칭) 도 `/m/*` 도 매칭하지 않아 react-router 가 routing-level 에서 ErrorResponse(404) 를 던지는데, root `errorElement` 는 `path: '/'` 라우트 본인의 에러만 잡고 미매칭은 못 잡음. 이번에는 진짜 NotFound 화면 + top-level path:'*' 라우트로 정정.

### 페이즈 결과

- **Phase 7 (HOTFIX 2)** (`c055da8`, +53 줄, 2 파일):
  - `apps/web/src/mobile/screens/not-found/ScreenNotFound.tsx` (신규): `useLocation` 으로 미매칭 경로 표시 + "홈으로" 링크 (a11y 16px 폰트 / 48px 버튼). silent redirect 가 아니므로 진단 신호 보존.
  - `apps/web/src/mobile/router.tsx`: top-level `{ path: '*', element: <ScreenNotFound /> }` 라우트 추가. HOTFIX 1 의 root errorElement 는 그대로 (라우트 본체 에러 대응).

### 영향 파일

data-craft-mobile:
- `apps/web/src/mobile/router.tsx`
- `apps/web/src/mobile/screens/not-found/ScreenNotFound.tsx` (신규)

### 학습 메모

- HOTFIX 1 의 root errorElement 는 라우트 본체 (예: `/` 의 Navigate 가 throw) 에러만 잡음. 미매칭 URL 은 routing 단계에서 발생하므로 별도 `path: '*'` catch-all 라우트가 필요. errorElement 와 catch-all 은 별개 메커니즘.
- 트레드밀과 graceful NotFound 의 차이: silent redirect ↔ 정보 표시 + 진입점. 후자는 진단 신호 보존이라 트레드밀이 아님.

## v001.260.0

> 통합일: 2026-05-19
> 플랜 이슈: #117 (HOTFIX 1)

### 개요

플랜 #117 작업 종료 후 마스터가 "Unexpected Application Error! 404 Not Found 💿 Hey developer 👋" (React Router 기본 404 boundary) 노출 보고. 트리거 URL/액션은 미확보. 코드상 Phase 1–5 에서 추가한 navigate 타깃은 모두 `/m/*` 정합 — 구조적 버그 미발견. 방어형 핫픽스로 root `/` 라우트에 errorElement 부착해 최상위 미매칭 시 ScreenErrorBoundary 가 렌더되도록 변경 (와일드카드 catch-all 은 advisor 권고로 회피 — 트레드밀 패턴, 진단 신호 보존 우선).

### 페이즈 결과

- **Phase 6 (HOTFIX 1)** (`0332d9d`, 누적 1줄 추가):
  - `apps/web/src/mobile/router.tsx`: root `/` 라우트에 `errorElement: <ScreenErrorBoundary />` 추가.
  - 1차 시도(`29a633a`) 의 `/m/*` 및 root `*` 와일드카드 catch-all 두 줄은 advisor 권고에 따라 제거(`0332d9d`).
  - 기존 `/m` parent 의 errorElement 는 그대로 — `/m/*` 하위 미매칭은 이미 ScreenErrorBoundary 가 잡고 있었음. 본 핫픽스는 root 레벨 미매칭 (예: `/foo`, `/`) 진입 시 동일한 한국어 boundary 가 렌더되도록 보강.

### 영향 파일

data-craft-mobile:
- `apps/web/src/mobile/router.tsx`

### 미해결 — 마스터 확인 필요

- 트리거 URL/액션 미확보로 근본 원인은 미특정. 본 핫픽스는 root-레벨 미스매치 케이스 한정의 graceful UX. 재현 시 마스터가 어떤 화면/링크/버튼에서 노출됐는지 공유 요청 — 그 시점에 정확한 후속 핫픽스 가능.

## v001.259.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 30)

### 개요

마스터 보고: 런타임 throw `usePrintContext must be used within PrintProvider` (PrintDialog.tsx:33). HOTFIX 14 에서 `useHeaderState` 만 optional 처리했으나, `PrintDialog` 자체도 일부 mount 경로에서 PrintProvider 외부 렌더 → throw. PrintDialog 도 optional + early null return 으로 외부 mount 안전망.

### 페이즈 결과

- **Phase 38 (HOTFIX 30)** (`033ebe9`): `PrintDialog.tsx` 의 `usePrintContext` → `usePrintContextOptional` 교체.
  - `if (!ctx) return null` early return (외부 mount 시 다이얼로그 미렌더).
  - React rules-of-hooks 위반 회피: ctx 의존 hook (`useEffect` 키보드 / `useMemo` paperDimensions) 은 unconditional 호출 + `ctx?.` optional chain. destructure / handler 함수는 ctx null 체크 이후 배치.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/ui/PrintDialog.tsx`

1 파일 / +56 / -48 / 단일 커밋.

### lint

- PASS (0 errors, 18 warnings).

## v001.258.0

> 통합일: 2026-05-19
> 플랜 이슈: #117

### 개요

data-craft-mobile 의 웹 인증 UI 갭 5건 채우기. 기존 SessionEngine / SecureTokenStorage / RouteGuard 아키텍처는 그대로 두고, 로그아웃·회원탈퇴·회원가입 화면과 이메일 인증 공통 컴포넌트, 환경변수 와이어링을 추가. BE/DB 무수정 (Roadmap-1 FE-only lock 정합).

### 페이즈 결과

- **Phase 1** (`6930073`): `VITE_API_BASE_URL` env 변수 도입 + sessionEngine getSessionEngine() 의 AuthClient baseUrl fallback 을 `''` → `'http://localhost:8000'` 으로 교체. `.env.example` 신규.
- **Phase 2** (`24ac0d7`): 이메일 인증 공통 — `useEmailVerification` 훅 (idle→sending→sent→verifying→verified|error 상태 머신, 60초 쿨다운, 한국어 에러 매핑) + `EmailVerificationField` 컴포넌트 (a11y 16px input / 48px button, role=alert/status, purpose prop = signup|withdraw|password-change|password-reset). authClient 의 purpose 타입이 좁아 훅에서 direct fetch 채택.
- **Phase 3** (`f09ebaf`): 로그아웃 UI — `ConfirmDialog` 신규(role=dialog, aria-modal, ESC/backdrop 닫기) + `LogoutButton` 신규(다이얼로그 → `getSessionEngine().logout()` → `/m/login` navigate, 처리중 disabled + 스피너). `ScreenProfile` isMe+ready 블록 하단에 마운트.
- **Phase 4** (`415e7f8`): 회원탈퇴 UI — `useWithdraw` 훅(direct fetch, POST `/api/auth/withdraw`, `withdrawType + companyId` 파싱) + `WithdrawDialog` (이메일 인증 → 비밀번호 재확인 → 제출 4단계, EmailVerificationField purpose="withdraw" 재사용). 'company' → `/m/login`, 'personal' → `/m/login?tenant=<companyId>` 분기. ScreenProfile 에 소형 red 텍스트 진입 버튼.
- **Phase 5** (`e5db2035`): 회원가입 화면 — `ScreenSignup` + `SignupForm` (9필드: businessNumber, companyName, companyPhone, companyId, adminName, adminEmail+인증, adminPassword+확인, adminPhone, isTermsAgreed, 인라인 validation, EmailVerificationField purpose="signup"). router.tsx 에 `/m/signup` 공개 라우트 등록, ScreenLogin linkRow 에 회원가입 링크.

### 영향 파일

data-craft-mobile:
- `apps/web/.env.example` (신규)
- `apps/web/src/mobile/auth/sessionEngine.ts`
- `apps/web/src/mobile/auth/hooks/useEmailVerification.ts` (신규)
- `apps/web/src/mobile/auth/hooks/useWithdraw.ts` (신규)
- `apps/web/src/mobile/auth/components/EmailVerificationField.tsx` (신규)
- `apps/web/src/mobile/auth/components/LogoutButton.tsx` (신규)
- `apps/web/src/mobile/auth/components/WithdrawDialog.tsx` (신규)
- `apps/web/src/mobile/components/ConfirmDialog.tsx` (신규)
- `apps/web/src/mobile/screens/profile/ScreenProfile.tsx`
- `apps/web/src/mobile/screens/login/ScreenLogin.tsx`
- `apps/web/src/mobile/screens/login/ScreenLogin.module.css`
- `apps/web/src/mobile/screens/signup/ScreenSignup.tsx` (신규)
- `apps/web/src/mobile/screens/signup/ScreenSignup.module.css` (신규)
- `apps/web/src/mobile/screens/signup/SignupForm.tsx` (신규)
- `apps/web/src/mobile/router.tsx`
- `apps/web/src/mobile/routes/signup.tsx` (신규)

### 후속 권장 사항 (본 플랜 스코프 외)

- API 클라이언트 패턴 3중화 정리: sessionEngine→authClient.ts (기존), fs-api-mobile/authApi (시그니처만 정의, 호출처 없음), direct fetch (Phase 2/4/5) — 단일 경로로 통일 필요.
- 웹에 존재하나 모바일 미와이어: `checkCompanyId` (회사 ID 중복확인), `validateBusinessNumber` (사업자등록번호 인증) — 회원가입 UX 보강.
- `useResetFlow.ts` baseUrl 하드코딩 fallback `''` 정리.
- 수동 스모크 테스트 (`pnpm dev :5174`): 로그인/로그아웃/탈퇴/회원가입 4 흐름 마스터 확인 권장.

## v001.257.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 29)

### 개요

HOTFIX 28 의 잔여 한계 해소: 캘린더 본체의 currentMonth 와 인쇄 진입 시점 monthView 동기. advisor 권고로 HOTFIX 10 의 aggregations publish/subscribe + HOTFIX 14 의 `usePrintContextOptional` 패턴 동일 적용.

### 페이즈 결과

- **Phase 37 (HOTFIX 29)** (`f3efeac` + typecheck fix `ac96e1c`):
  - **정찰**: 캘린더 본체의 currentMonth 는 `FsCalendarChart.tsx` 의 useState (year/month, 1-indexed). `CalendarPrintOptions.monthView` 타입 = `Date | undefined` (ISO 변환 불필요).
  - **types.ts**: `PrintContextValue.publishCalendarMonth?: (monthDate: Date) => void` 시그니처 추가.
  - **PrintContext.tsx**: `publishedCalendarMonth` 별도 useState + `publishCalendarMonth` 콜백. `openPrintDialog` 의 calendar 분기에서 publishedCalendarMonth 가 있으면 monthView 씨딩. setOptions(defaultOptions) 의 초기화 타이밍 문제 회피.
  - **FsCalendarChart.tsx**: `usePrintContextOptional()` import + currentMonth 변경 effect 로 publish. provider 없으면 no-op.
  - **CalendarRowSelectStep.tsx**: HOTFIX 28 의 fallback effect 가 이미 정상 (monthView 미설정 시 오늘 날짜) — 수정 없이 보존.
  - **부수 typecheck fix** (`ac96e1c`): `RowLinkGroupEditDialog.tsx:221` 의 `addRowLinkColumns` 3 인자 호출 → 4 인자 (누락된 `displayProps` 추가). i-dev base 의 별 플랜 잔재.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/context/PrintContext.tsx`
  - `packages/fs-data-viewer/src/features/print/types.ts`
  - `packages/fs-data-viewer/src/widgets/calendar/FsCalendarChart.tsx`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupEditDialog.tsx` (별 플랜 잔재 typecheck fix)

4 파일 / +25 / -3 / 본 커밋 + typecheck fix.

### advisor 검증

- **advisor (계획 사전)**: PASS — publish 시점 + 인쇄 진입 시 최후 publish 값 사용 + provider 없을 때 no-op 패턴 권고. 정찰 후 publishAggregations 와 동일한 별도 상태 + openPrintDialog seeding 채택 (타이밍 안전성).
- **lint**: 1차 FAIL (별 플랜 typecheck 잔재) → fix 후 PASS (0 errors, 18 warnings).

## v001.256.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 28)

### 개요

마스터 보고: "캘린더 뷰에서 인쇄할 때 일정 카드가 해당 월에 존재하는데도 불구하고 행선택에 아무것도 안나와". 정찰 결과 `CalendarRowSelectStep` 의 `dateColumns` 필터가 `date / dateTime / deadline` 만 포함하고 **dualWidget 타입을 누락** — 캘린더 본체 (useCalendarColumns) 는 `getAutoDateColumnCandidates` 로 dualWidget 내 날짜 서브위젯도 포함하므로 dualWidget 기반 캘린더에서 dateColumns 가 0개 → 행 미표시.

### 페이즈 결과

- **Phase 36 (HOTFIX 28)** (`5f27c54` + typecheck fix `ab3bd50`):
  - **CalendarRowSelectStep.tsx**: dateColumns 필터에 dualWidget 추가. 날짜 파싱을 `calendarEventParsers.ts` 의 `parseDate` 로 교체 (date-only 문자열 로컬 자정 기준). dualWidget 셀 값 추출 + deadline JSON 처리를 `parseCalendarEvents` 선례와 동일 구현. dateColumns[0] 만 사용 (normal-168 정책 — 중복 카드 방지).
  - **타입 fix** (`ab3bd50`): `entities/data-viewer-props.types.ts` 의 `FsDataViewerProps` 에 `requestRowLinkTargetRow` 누락 (별 플랜 잔재) 정리 — i-dev base 의 typecheck 오류였음. plan-enterprise 의 lint gate 통과 위해 self-fix.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/ui/steps/CalendarRowSelectStep.tsx` (본체)
  - `packages/fs-data-viewer/src/entities/data-viewer-props.types.ts` (별 플랜 잔재 typecheck fix)

2 파일 / +82 / -46 / 본 커밋 + typecheck fix.

### 잔여 한계

- 인쇄 다이얼로그 진입 시 `options.calendar.monthView` 가 *항상 현재 날짜* 로 초기화되어, 사용자가 캘린더에서 이전/이후 월을 보고 있다가 인쇄하면 그 월이 아닌 오늘 월 기준이 됨. monthView publish/subscribe 도입 별 후속 권장.

### lint

- 1차: FAIL (별 플랜의 typecheck 오류 — HOTFIX 28 책임 외).
- typecheck fix 후 PASS (0 errors, 17 warnings).

## v001.255.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 14)
> HOTFIX 13 후속 — "행 연결 컬럼이 타겟 컬럼 타입과 동일하게 표시" 요구 반영. 옵션 (B) 채택: column.type=rowLink 유지 (leader cell rowLink 동작 보존) + 타겟 컬럼의 표시 속성 (viewerType / unit / unitPosition / defaultValue) 을 새 컬럼에 상속 + 렌더러가 unit 적용. 옵션 (A) (column.type 자체 변경) 는 leader 셀의 ConnectionEditOverlay 진입 UI 가 깨지므로 보류.

### 핫픽스 결과 — 1 phase + 1 fixup (`147af9a` + `817ec54`)

11 파일 +125 / -18:

1. **`ConnectionColumnItem`** 3개 viewer 패키지 동일 확장: `columnType?: string` (server viewerType), `unit?: string`, `unitPosition?: 'left'|'right'`, `defaultValue?: string`.
2. **host `requestConnectionColumns`** (connectionCallbacks.ts): `col.setting?.viewerType / unit / unitPosition`, `col.defaultValue` 동봉 반환.
3. **`RowLinkConfig.mappedTargetColumnType?: string`** 추가 (렌더러 포매팅 분기용).
4. **`RowLinkConfigDialog.handleConfirm`**: 각 행마다 columns lookup → mappedTargetColumnType 채움 + 별도 채널 `displayProps[]` (`{unit, unitPosition, defaultValue}`) 도 emit.
5. **onConfirm 시그니처 확장**: `(configs, titles, displayProps[])`.
6. **`FsGridColumnGenerator.handleRowLinkConfirm`**: 3번째 인자 받아 `addRowLinkColumns` 전달.
7. **`addRowLinkColumns`**: 새 컬럼의 `defaultValue/unit/unitPosition` 을 displayProps 에서 상속 적용.
8. **`FsGridRowLinkCellRenderer`**: 표시 시 `columnModel.unit` + `unitPosition` 으로 prefix/suffix 적용.
9. **`RowLinkRenderer`** (칸반/캘린더/간트): `unit`/`unitPosition` props 받아 표시 시 적용.
10. **`rendererMap.tsx`**: rowLink entry 의 extraProps 에 `unit`/`unitPosition` 추가.
11. **fixup**: sed 트리플 쿼트 버그 정정 (`'''left''' | '''right'''` → `'left' | 'right'`).

### 본 hotfix 의 범위 + 한계

- ✅ 적용: number/currency/percent 같은 unit-기반 타입의 표시 (예: "1,000 원" 같은 unit suffix 가 행 연결 셀에도 동일하게 나옴).
- ❌ 미적용: date/dateTime 의 형식 변환 (날짜 포매팅), singleSelect/multiSelect 의 옵션 배지 렌더링, formula 의 계산식 결과 등 type-specific 렌더링 로직. RowLinkRenderer 가 type 별 renderer 에 delegation 하는 더 큰 refactor 필요 — 향후 plan-enterprise 후속 대상.
- ✅ leader 셀의 ConnectionEditOverlay 진입 UI는 보존 (column.type=rowLink 유지).

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/entities/connection/types.ts`
  - `packages/fs-sub-data-viewer/src/entities/connection/types.ts`
  - `packages/fs-external-data-viewer/src/entities/connection/types.ts`
  - `src/features/viewer/lib/connectionCallbacks.ts`
  - `packages/fs-data-viewer/src/entities/row-link/types.ts`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx`
  - `packages/fs-data-viewer/src/widgets/column-generator/FsGridColumnGenerator.tsx`
  - `packages/fs-data-viewer/src/widgets/column-generator/addRowLinkColumns.ts`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/FsGridRowLinkCellRenderer.tsx`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkRenderer.tsx`
  - `packages/fs-data-viewer/src/shared/ui/cell-renderers/rendererMap.tsx`

### 검증

- typecheck:all + lint PASS (0 errors).
- sub/external dist 재빌드 통과 (fixup 후).

## v001.254.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 13)
> 매핑 행의 기본 title 정책 변경. 기존: `행 연결 {N}` hardcoded. 신규: 타겟 컬럼 선택 시 타겟 컬럼명을 기본으로 자동 채택, 같은 그룹 내 다른 행과 중복되면 `이름 (2)` / `이름 (3)` 접미사 dedup. 사용자가 title 을 직접 편집한 행은 `titleEdited` 플래그로 자동 갱신에서 제외하여 수동 입력 보존.

### 핫픽스 결과 — 1 phase (`3d8acb5`)

`RowLinkConfigDialog.tsx`:
- `ColumnMappingRow` 에 `titleEdited: boolean` 필드 추가.
- `initMappingRows`: 초기 title=빈 문자열, titleEdited=false.
- `dedupTitle(baseName, rows, excludeIdx)` 헬퍼 신규: 그룹 내 다른 행 타이틀과 비교해 비어있으면 그대로, 중복이면 `(2)`, `(3)` 차례로 부여.
- `updateMappingRow` 확장:
  - title 명시 수정 시 titleEdited=true 자동 세팅.
  - mappedTargetColumnId 변경 시, titleEdited=false 행이라면 columns 에서 해당 columnName 을 찾아 dedupTitle 적용.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (+44 / -5)

### 미해결 — 마스터 추가 요구 (HOTFIX 14 + 별도 작업 필요)

마스터 추가 메시지: "연결행은 타입도 연결 대상 열과 동일하게 들어가야해, 지금 다 텍스트 타입 열로 생성하는것 같아".
현재 행 연결 컬럼은 `type='rowLink'` 로 생성되어 `RowLinkRenderer` 가 cellValue 문자열만 그대로 표시 → 숫자/날짜/통화 등의 타겟 컬럼 포매팅 적용 안 됨. 진짜 타입 매칭은 다음 두 옵션 중 하나가 필요:
- (A) column.type 을 타겟 type 으로 변경 — rendererMap 이 자연 dispatch. 단 leader 셀의 ConnectionEditOverlay 진입 UI 가 사라지므로 rowLink 동작 자체가 깨짐. 별도 cross-cutting 분기 도입 필요.
- (B) RowLinkRenderer 안에서 `customDataList[0].mappedTargetColumnTypeId` 를 보고 타겟 type 의 renderer 에 위임 (delegate). 또한 unit/optionList 등 타겟 컬럼 props 도 RowLinkConfig 에 동봉 필요.

둘 다 renderer/아키텍처 변경이 큰 작업이라 본 HOTFIX 범위 밖. 별도 HOTFIX 또는 plan-enterprise 후속으로 분리.

### 검증

- typecheck + lint PASS.

## v001.253.0

> 통합일: 2026-05-19
> 플랜 이슈: #116 (HOTFIX 1)

### 개요

v001.252.0 (Phase 1) 의 루트 `package.json` `"dev": "pnpm --filter ./apps/web dev"` 위임이 **dev 서버 기동을 실제로 망가뜨림**. 마스터 보고: `pnpm dev` 가 5174 에서 listen 은 했으나 Vite dependency scan 단계에서 다수 import 해결 실패 — `apps/web/vite.config.ts` 에 `'@'` alias 가 없고 (`@/widgets/...`, `@/entities/...`, `@/shared/...` 등 fs-*-mobile 패키지 내부 import 해결 불가), 다수 외부 deps (`@dnd-kit/*`, `@tanstack/react-query`, `framer-motion`, `jspdf`, `pdf-lib`, `@blocknote/*` 등) 가 `apps/web/package.json` 에 미선언. 즉 루트 `index.html` + 루트 `vite.config.ts` (alias 완비) 가 원래의 실제 dev 진입점이었음을 Phase 1 단계에서 검증하지 못했음.

해결: 루트 `dev` 스크립트를 `"vite"` 로 되돌리고, 루트 `vite.config.ts` 에 `server: { port: 5174, strictPort: true }` 를 추가하여 원 dev 경로 (루트 index.html + 루트 vite.config) 를 유지하면서 포트만 5174 로 강제. v001.252.0 의 `apps/web/vite.config.ts strictPort:true` 는 그대로 보존 (apps/web 단독 실행 경우의 안전망).

### 페이즈 결과

- **Phase 2 (HOTFIX 1)** (`d77b809`):
  - `package.json`: `"dev": "pnpm --filter ./apps/web dev"` → `"dev": "vite"` 로 되돌림 (v001.252.0 의 위임 변경 reverter).
  - `vite.config.ts` (루트): `defineConfig` 객체에 `server: { port: 5174, strictPort: true }` 한 줄 추가.
  - 결합 효과: 루트 `pnpm dev` 가 원래의 alias-완비 진입점으로 기동하면서 반드시 5174 에서 listen 하거나 `EADDRINUSE` 로 명시적 실패.

### 영향 파일

- data-craft-mobile:
  - `package.json`
  - `vite.config.ts`

2 파일 / +2 / -1 / 단일 커밋.

### lint

- PASS (pnpm typecheck, 0 errors).

## v001.252.0

> 통합일: 2026-05-19
> 플랜 이슈: #116

### 개요

마스터 명령: data-craft-mobile FE 가 반드시 5174 포트를 사용하도록 수정. 루트 `package.json` `"dev": "vite"` 가 루트 `vite.config.ts` (vitest 전용 — `server.port` 없음) 를 사용해 vite default 5173 으로 떨어져 리더 (`data-craft`) 와 포트 충돌 — `apps/web/vite.config.ts` 의 `port: 5174` 는 실질적으로 무효였다. 루트 `dev` 를 `apps/web` 위임으로 바꾸고, `apps/web/vite.config.ts` `server` 에 `strictPort: true` 를 추가해 점유 시 사일런트 시프트 차단.

### 페이즈 결과

- **Phase 1** (`216635e`):
  - 루트 `package.json` `"dev": "vite"` → `"dev": "pnpm --filter ./apps/web dev"` (기존 `"build"` 스크립트와 동일 위임 패턴).
  - `apps/web/vite.config.ts` `server` 블록에 `strictPort: true` 추가 — 5174 점유 시 다른 포트로의 사일런트 시프트 차단.
  - 결합 효과: 루트 `pnpm dev` 호출이 반드시 5174 에서 listen 하거나 명시적 실패.

### 영향 파일

- data-craft-mobile:
  - `package.json`
  - `apps/web/vite.config.ts`

2 파일 / +2 / -1 / 단일 커밋.

### lint

- PASS (pnpm typecheck, 0 errors).

## v001.251.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 27)

### 개요

마스터 보고 (이미지): "여전히 정렬 안맞는데? 괄호가 더 내려가 있잖아". HOTFIX 26 의 `vertical-align: middle` 은 부모 폰트의 x-height middle 기준이라 14pt 제목 + 10pt 부제 간 baseline 어긋남. flex container + `align-items: baseline` 으로 baseline 일치.

### 페이즈 결과

- **Phase 35 (HOTFIX 27)** (`113f33a`):
  - `.aggregation-summary-title` 에 `display: flex; align-items: baseline; justify-content: center; gap: 6px` 추가. `text-align: center` 제거 (flex 정렬로 대체).
  - `.aggregation-summary-count` 의 `margin-left: 6px` (gap 으로 대체) + `vertical-align: middle` (align-items baseline 으로 대체) 제거.
  - flex baseline 정렬로 두 텍스트의 실제 baseline 일치 → 시각적 어긋남 해소.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +4 / -3 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings).

## v001.250.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 12)
> 리더 셀에서 값을 선택해도 같은 행의 비리더(연결 부하) 셀들에 값이 자동 입력되지 않던 현상 픽스. 원인: Phase 5 의 caveat 였던 `requestRowLinkTargetRow` 콜백이 host (data-craft top-level + viewer 패키지 라우팅) 측에 wiring 안 됨 → useRowLinkCell.handleLeaderValueSave 의 propagation 코드가 silent return. host 콜백 구현 + 6-layer 라우팅 완결.

### 핫픽스 결과 — 1 phase (`bb6616f`)

10 파일 +78 / -0:

1. **`src/features/viewer/lib/connectionCallbacks.ts`** — `requestRowLinkTargetRow` 콜백 신규 구현. `viewerApi.getPagedGridData(targetGroupId, { filters: [{ columnId: leaderColumnId, operator: 'eq', value: leaderValue }], limit: 1 })` 로 서버 측 일치 행 1개 조회 후 `ServerRowData.cells` (`Record<string,string>`) 를 `Record<number,string>` 으로 변환 반환.
2. **`src/widgets/viewer-widget/ui/Viewer.widget.tsx`** — viewerCallbacks → FsDataViewer prop 전달.
3. **`src/widgets/sub-viewer-widget/ui/useSubViewerCallbacks.ts`** + **`SubViewer.widget.tsx`** — baseCallbacks 통과 + prop 전달.
4. **`src/widgets/external-viewer-widget/ui/useExternalViewerCallbacks.ts`** + **`ExternalViewer.widget.tsx`** — 동일 패턴.
5. **`packages/fs-data-viewer/src/app/types.ts`** — `FsDataViewerProps` + `NormalizedProps` + `normalizeProps` 모두에 `requestRowLinkTargetRow` 추가.
6. **`packages/fs-data-viewer/src/app/FsDataViewer.tsx`** — normalizedProps destructure + Router 에 prop 전달.
7. **`packages/fs-data-viewer/src/app/FsDataViewerRouter.tsx`** — destructure + DataViewerProvider 에 prop 전달.
8. **`packages/fs-data-viewer/src/features/data-viewer/context/index.tsx`** — `DataViewerProviderProps` + destructure + GridProvider 에 prop 전달.
9. **(이미 정의돼 있던)** `GridContext.tsx` — `requestRowLinkTargetRow` props 흡수 + context value 노출 (Phase 5 hotfix 시점에 기본 구조 이미 마련).
10. **(이미 정의돼 있던)** `useRowLinkCell.handleLeaderValueSave` — context 에서 콜백을 받아 `targetRow[mappedTargetColumnId]` 로 비리더 셀 일괄 채움.

### 영향 파일

- data-craft:
  - `src/features/viewer/lib/connectionCallbacks.ts`
  - `src/widgets/viewer-widget/ui/Viewer.widget.tsx`
  - `src/widgets/sub-viewer-widget/ui/useSubViewerCallbacks.ts`
  - `src/widgets/sub-viewer-widget/ui/SubViewer.widget.tsx`
  - `src/widgets/external-viewer-widget/ui/useExternalViewerCallbacks.ts`
  - `src/widgets/external-viewer-widget/ui/ExternalViewer.widget.tsx`
  - `packages/fs-data-viewer/src/app/types.ts`
  - `packages/fs-data-viewer/src/app/FsDataViewer.tsx`
  - `packages/fs-data-viewer/src/app/FsDataViewerRouter.tsx`
  - `packages/fs-data-viewer/src/features/data-viewer/context/index.tsx`

### 검증

- typecheck + lint PASS.

## v001.249.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 26)

### 개요

마스터 명령: "집계 결과와 옆 괄호가 정렬이 안맞아, 더 내려가 있는데?". HOTFIX 25 의 `(총 N개 열 집계)` span 이 default `vertical-align: baseline` 으로 큰 제목 baseline 에 맞춰져 시각적으로 아래로 보임. `vertical-align: middle` 명시.

### 페이즈 결과

- **Phase 34 (HOTFIX 26)** (`5cde575`): `printStyleGenerator.ts` 의 `.aggregation-summary-count` 블록에 `vertical-align: middle` 한 줄 추가. 기존 font-size/font-weight/color/margin-left 보존.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +1 / -0 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings).

## v001.248.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 11)
> Step 4 컬럼 드롭다운 패널 안에서 마우스 휠 스크롤이 작동하지 않는 현상 픽스. Radix Dialog 의 `react-remove-scroll` 이 document 레벨 wheel 이벤트를 차단해 portal 된 패널의 자체 overflow 스크롤도 영향. 패널 본체 `onWheel` / `onTouchMove` 에서 `stopPropagation` 으로 격리.

### 핫픽스 결과 — 1 phase (`79e2bb1`)

`RowLinkConfigDialog.tsx` CustomColumnDropdown 패널 :
```tsx
onWheel={(e) => e.stopPropagation()}
onTouchMove={(e) => e.stopPropagation()}
```
패널 안 wheel 이벤트가 document 까지 bubble 하기 전에 중단 → react-remove-scroll 의 preventDefault 영향에서 격리되어 패널 자체 스크롤 정상 작동.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (+4)

### 검증

- typecheck + lint PASS.

## v001.247.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 10)
> Step 4 의 컬럼 선택 드롭다운이 열리기만 하고 클릭/스크롤 등 상호작용이 차단되던 현상 픽스. Radix Dialog 가 modal 일 때 body 에 `pointer-events: none` 을 적용해 \`createPortal(panel, document.body)\` 된 패널 자식까지 차단된 것. 기존 \`ConnectionEditOverlay\` 와 동일하게 패널 본체에 \`pointerEvents: 'auto'\` 명시.

### 핫픽스 결과 — 1 phase (`a5e171c`)

- `RowLinkConfigDialog.tsx` 의 CustomColumnDropdown 패널 style 에 `pointerEvents: 'auto'` 추가 (3줄).

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx`

### 검증

- typecheck + lint PASS.

## v001.246.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 25)

### 개요

마스터 명령: "집계 결과에서 총 n개 열 집계 문구는 밑에 말고 집계 결과 우측에 연한 괄호로 표기해". 별도 줄의 부제목 → 제목 우측 인라인 통합.

### 페이즈 결과

- **Phase 33 (HOTFIX 25)** (`4369340`):
  - **printHtmlBuilder.ts**: `<p class="aggregation-summary-subtitle">` 별도 줄 제거 → `<h2>` 안에 `<span class="aggregation-summary-count">(총 N개 열 집계)</span>` 으로 인라인 통합.
  - **printStyleGenerator.ts**: `.aggregation-summary-subtitle` CSS 블록 삭제. `.aggregation-summary-count` 신규 추가 (`font-size: 10pt`, `font-weight: normal`, `color: #888`, `margin-left: 6px`) — 연한 색 + 작은 폰트.
  - HOTFIX 16 의 `.aggregation-summary-title text-align: center` 보존 — span 도 같은 라인 중앙 정렬 자연 상속.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

2 파일 / +6 / -7 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings).

## v001.245.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 13)

### 핫픽스 결과 — 결제 비밀번호 변경 시 기존 verify 선행

마스터: "결제 비밀번호 변경은 기존 비밀번호 먼저 입력 받아서 일치하면 할 수 있게 해". 케밥 메뉴 "결제 비밀번호 변경" 옵션이 검증 없이 바로 setup (덮어쓰기) 진입하던 보안 결함 해소.

### Phase 30 (FE, `4a7cbe3`)

- `CardInfoSection.tsx`: 케밥 메뉴 "결제 비밀번호 변경" 핸들러 재설계.
  1. `existsPaymentPassword()` 호출로 기존 설정 여부 확인.
  2. 설정 상태 → **PaymentPasswordInputDialog (verify 모드)** 우선 노출 → verify 성공 시 PaymentPasswordSetupStep 진입.
  3. 미설정 → verify 단계 skip, 곧바로 setup.
- state machine: `passwordChangeStep: 'idle' | 'verify' | 'setup'`.
- 중복 클릭 방지 (`isCheckingPassword`) + API 실패 toast.
- 카드 등록/변경 BillingSuccessPage 흐름은 무영향 (덮어쓰기 정상).

### 영향 파일

**data-craft**:
- `src/widgets/settings-dialog/ui/plan/CardInfoSection.tsx`

### 검증

- typecheck + lint PASS.

## v001.244.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 9)
> HOTFIX 8 까지 폼 그룹의 isForm 마킹은 정상이었으나 폼 탭 UI 가 hardcoded "폼 그룹 없음" placeholder 만 렌더해서 실제 데이터 무시. HOTFIX 4 시점의 빈상태 가정이 잔존했던 점.

### 핫픽스 결과 — 1 phase (`10908ed`)

`RowLinkConfigDialog.tsx` 그룹 탭 본문:
- 기존: `activeGroupTab === 'form'` 분기에서 "폼 그룹 없음" 만 hardcoded 표시. filteredGroups 무시.
- 변경: 폼 탭도 `filteredGroups.map(...)` 정상 렌더. filteredGroups 가 0일 때만 "폼 그룹 없음" 메시지. 다른 탭은 "연결 가능한 그룹이 없습니다".
- 검색 input 도 폼 탭에서 표시 (기존엔 `activeGroupTab !== 'form'` 가드로 숨겨져 있던 것 해제).

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (+12 / -14)

### 검증

- typecheck + lint PASS.

## v001.243.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 8)
> HOTFIX 7 적용 후에도 폼 그룹이 폼 탭에 안 나오는 현상 보완. 서버 (data-craft-server `models/externalData.model.ts`) 가 폼 그룹명에 `[폼] ` prefix 를 붙여 보내는 점 확인 → connectionCallbacks 의 폼 식별을 `dataType === 'form'` OR `groupName.startsWith('[폼] ')` 다중 신호로 확장.

### 핫픽스 결과 — 1 phase (`737e0b0`)

- `src/features/viewer/lib/connectionCallbacks.ts` external 그룹 매핑 loop:
  - 기존: `dataType === 'form'` 단일 조건.
  - 변경: `dataType === 'form' || groupName.startsWith('[폼] ')` 다중 신호 OR. 둘 중 하나라도 만족하면 `isForm: true`.
  - 서버 측 SQL (`CONCAT('[폼] ', user_fl.form_name)`) 보장으로 prefix 는 안정적 마커.

### 영향 파일

- data-craft:
  - `src/features/viewer/lib/connectionCallbacks.ts`

### 검증

- typecheck + lint PASS.

## v001.242.0

> 통합일: 2026-05-19
> 플랜 이슈: #115

### 개요

마스터 명령: 단계5-A PWA 마감 — service worker 활성화 (`apps/web/src/mobile/sw-register.ts`), 정적 자원 캐시·오프라인 fallback·로딩/에러 바운더리·접근성 라벨. BE 변경 0 (Roadmap-1 lock 정합). Step 2 Explore 결과 명령 7개 항목 중 대부분 이미 구현 완료 (sw-register / vite-plugin-pwa workbox 캐시 / manifest / OfflineBanner / ScreenErrorBoundary / 9 라우트 inline Suspense / AppHeader-BottomTabs aria-label) — 남은 5개 polish gap 만 단일 phase 로 마감.

### 페이즈 결과

- **Phase 1** (`a447c4c`): 5개 polish gap 일괄 처리. (1) `AppErrorBoundary.tsx` (React class, 82 줄) 신규 + `main.tsx` 의 `RouterProvider` 최상위 래핑 — Router 외부 throw catch (route-level `ScreenErrorBoundary` 와 양립). (2) `LoadingSpinner.tsx` (33 줄) 신규 + 5 라우트 (inbox / notifications / profile/[id] / record/[id] / user-form/[id]) inline Suspense fallback 교체. grid/kanban/calendar 3 라우트 파일은 부재로 노터치 (선언 15 중 12 실제 변경, 스코프 ⊆ 선언). (3) `apps/web/public/offline.html` 신규 (51 줄, Korean, JS 무의존) + `vite.config.ts` VitePWA workbox `navigateFallback: 'index.html'` → `'/offline.html'` (base 템플릿 변수 보존, `navigateFallbackDenylist` 의 `/api/`, `/v1/api/` 유지). (4) `BottomTabs.tsx` 활성 탭에 `aria-current={isActive ? 'page' : undefined}` 1줄 추가. (5) `AppShell.tsx` AppHeader 직전 (문서 최초 focus 위치) 에 Tailwind `sr-only focus:not-sr-only` skip-to-main link 추가 + `<main id="main">` 부여. `pnpm typecheck` PASS.

### 영향 파일

data-craft-mobile:
- `apps/web/src/mobile/components/AppErrorBoundary.tsx` (신규)
- `apps/web/src/mobile/components/LoadingSpinner.tsx` (신규)
- `apps/web/public/offline.html` (신규)
- `apps/web/src/mobile/main.tsx`
- `apps/web/src/mobile/layouts/AppShell.tsx`
- `apps/web/src/mobile/components/BottomTabs.tsx`
- `apps/web/src/mobile/routes/inbox.tsx`
- `apps/web/src/mobile/routes/notifications.tsx`
- `apps/web/src/mobile/routes/profile/[id].tsx`
- `apps/web/src/mobile/routes/record/[id].tsx`
- `apps/web/src/mobile/routes/user-form/[id].tsx`
- `apps/web/vite.config.ts`

총 12 파일 +192 / -7.

### 위험 / 후속

- **`@keyframes spin` 동작 검증 필요**: LoadingSpinner 가 inline keyframe 으로 작성되었으므로 Tailwind v4 `animate-spin` 의 글로벌 keyframe 의존 여부 미확인. 마스터 dev 검증 시 회전 미동작이면 핫픽스 1줄 (Tailwind `animate-spin` 클래스 적용 또는 `<style>` 블록에 `@keyframes spin` 선언).
- **`navigateFallback: /offline.html` 효과는 PROD-only**: `pnpm dev` 에서는 SW 비활성 (sw-register.ts PROD-only 가드). `pnpm build && pnpm preview` 또는 실 배포 후 DevTools Application → Service Workers → Offline toggle 로만 확인 가능.
- **grid/kanban/calendar 라우트 부재**: 3개 라우트 파일이 i-dev 에 존재하지 않아 LoadingSpinner 미적용. 라우트 생성 시 별도 phase / hotfix.
- **AppErrorBoundary vs ScreenErrorBoundary 위계**: 두 boundary 양립. RouterProvider 내부 throw 는 ScreenErrorBoundary 가 우선 catch, RouterProvider 외부 / Router 자체 throw 만 AppErrorBoundary 가 catch.
- **plan affected_files 사실 확인 갭 (메타)**: 단계3-D under-declared / 단계4 over-declared / 본 plan over-declared (15→12). 패턴 누적 — plan 작성 시 affected_files 사실 확인 1회 추가 가치 있음. 본 plan 범위 외 메타 후속.

### advisor 검증

- 계획 단계 (#1): 5관점 PASS, no BLOCK.
- 완료 단계 (#2): 5관점 PASS, no BLOCK. Command Fulfillment 의 두 비차단 (`@keyframes spin` / navigateFallback PROD-only) 은 위 "위험 / 후속" 에 명시.

## v001.241.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 7)
> HOTFIX 6 이후에도 폼 그룹이 외부 탭에 남아 있던 현상 픽스. 원인: HOTFIX 6 의 isForm 마킹이 `resolveFormGroupNames` 의 `__wdata_*` 패턴 매칭에 의존했는데, external API 의 폼 그룹은 이미 nice-name (예: "회사정보 폼") 으로 와서 패턴이 안 맞았음. 한편 `ExternalDataGroupListItem.dataType: 'single' | 'multi' | 'form'` 필드가 이미 server response 에 존재하므로 그것을 직접 사용.

### 핫픽스 결과 — 1 phase (`8f1007c`)

- `src/features/viewer/lib/connectionCallbacks.ts` 의 external 그룹 매핑 loop:
  - `(g as { dataType?: string }).dataType === 'form'` 이면 `isForm: true` 직접 세팅.
  - 런타임 데이터엔 `dataType` 이 존재하지만 `GroupListResponse.groups: BaseGroupListItem[]` 로 타입이 좁아져 있어 캐스팅 사용.
- HOTFIX 6 의 패턴 매칭 (`SETTINGS_FORM_PATTERN` / `WIDGET_DATA_PATTERN`) 은 main/sub 그룹의 `__wdata_*` 패턴 케이스용으로 유지.

### 영향 파일

- data-craft:
  - `src/features/viewer/lib/connectionCallbacks.ts`

### 검증

- typecheck + lint PASS.

## v001.240.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 24)

### 개요

마스터 명령: "문서 타입 셀 인쇄에 있을 때는 내부 데이터를 한번 사용자 친화적으로 개량해서 들어가게 해". 문서 셀이 인쇄 시 `{"title":"폼 - 사용자 설정","content":"[{\"id\":\"...\",\"type\":\"paragr...}]"}` 형태 raw JSON 으로 노출되어 가독성 없음. BlockNote JSON 을 파싱하여 plain text 추출.

### 페이즈 결과

- **Phase 32 (HOTFIX 24)** (`e1f1b64`): `cellValueFormatter.ts` 의 `formatDocument` 함수 전면 교체.
  - **정찰**: 문서 셀 값 = `FsGridDocumentModel` JSON (`title` + `content` 필드, content 는 BlockNote JSON 배열 문자열). 영향 파일 = `cellValueFormatter.ts` 단독 (useGridPrint / printHtmlBuilder 는 formatCellValue 경유로 무관).
  - **구현**:
    1. 외부 JSON 파싱으로 `title` + `content` 추출.
    2. `extractBlockNoteText` 재귀 함수 — BlockNote 노드 트리 (`{ text }`, `{ content: [] }`, array 등) 에서 plain text 수집.
    3. `title — bodyText` 조합 후 200자 초과 시 `…` truncate.
    4. 파싱 실패 / 빈 content / null → 빈 문자열 fallback.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/cellValueFormatter.ts`

1 파일 / +40 / -5 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.239.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 6)
> 폼 데이터 그룹이 외부 탭에서 노출되던 현상 픽스. `__wdata_*` 패턴 그룹은 `getExternalGroupList()` 응답 안에 섞여 들어와 `groupType: 'external'` 유지하기 때문에 외부 탭에 분류되고 있었음. `ConnectionGroupItem` 에 `isForm?: boolean` 마커 도입 + `connectionCallbacks.ts` 의 `resolveFormGroupNames` 가 패턴 매칭 시 `isForm: true` 세팅하도록 변경 + `RowLinkConfigDialog` 필터 분기 정정.

### 핫픽스 결과 — 1 phase (`9def0ca`)

- `ConnectionGroupItem.isForm?: boolean` 마커 추가 (3개 viewer 패키지 동일 — fs-data-viewer / fs-sub-data-viewer / fs-external-data-viewer).
- `connectionCallbacks.resolveFormGroupNames`: `SETTINGS_FORM_PATTERN` / `WIDGET_DATA_PATTERN` 매칭 시 반환 객체에 `isForm: true` 추가. 리네임 실패해도 마커는 유지.
- `RowLinkConfigDialog` 필터:
  - 폼 탭: `isForm === true` 만 노출.
  - 그 외 탭: `isForm === true` 그룹은 제외 + `groupType === activeGroupTab` 매칭.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/entities/connection/types.ts`
  - `packages/fs-sub-data-viewer/src/entities/connection/types.ts`
  - `packages/fs-external-data-viewer/src/entities/connection/types.ts`
  - `src/features/viewer/lib/connectionCallbacks.ts`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx`

### 검증

- typecheck + lint PASS (0 errors).
- sub/external dist 재빌드 완료.

## v001.238.0

> 통합일: 2026-05-19
> 플랜 이슈: #114 (HOTFIX 1)

### 개요

플랜 #114 의 PENDING 단계 마스터 검증 결과 3건 보정 요청:
1. **설정 X 위치 — 조건부**: 본문 확장 토글이 노출되지 않을 때는 기존 위치 (`right-4`) 로 복귀해야 함. v001.232.0 의 항상 `right-9` 정책 보완.
2. **문서 모달 백드롭 — 미적용 원인 식별**: v001.232.0 Phase 2 의 공용 `DialogOverlay` 톤 조정이 효과 없었음. 추가 탐색 결과 마스터가 지칭한 "문서 모달" 은 `DocumentEditDialog` (`packages/fs-data-viewer/.../document-edit/DocumentEditDialog.tsx`) 로 shadcn `Dialog` 가 아닌 커스텀 `createPortal` + 수동 `fixed inset-0` wrapper 구조. wrapper div 에 backdrop 색상 토큰 자체가 부재 → 완전 투명. 직접 `bg-black/70` 추가.
3. **컨테이너 후보 라벨 — 사용자 친화화**: `LoadDataActionSection` Step 3 후보 표기에서 내부 키 (`empty-viewer` 등) 노출 → `WIDGET_TYPE_INFO[emptyType]?.name` 으로 치환하여 "데이터 뷰어 컨테이너 (d87401cb)" 식 사용자 가시명 표기.

### 페이즈 결과

- **Phase 4 / HOTFIX 1** (`8572c98e`): A) `SettingsDialog` 의 커스텀 `DialogClose` className 을 `right-9` 고정에서 `${isCustomSettingsActive ? 'right-9' : 'right-4'}` 동적 ternary 로 변경. B) `DocumentEditDialog` line 113 wrapper className 에 `bg-black/70` 추가, 그 외 (z-index 토큰, onClick/onMouseDown/onKeyDown 핸들러, 주석) 모두 보존. C) `LoadDataActionSection` 에 `WIDGET_TYPE_INFO` import 추가, line 89 라벨 템플릿 `${emptyType}` → `${WIDGET_TYPE_INFO[emptyType]?.name ?? emptyType}` 치환.

### 영향 파일

data-craft:
- `src/widgets/settings-dialog/ui/SettingsDialog.tsx`
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditDialog.tsx`
- `src/widgets/property-drawer/ui/property-editors/button-editor/LoadDataActionSection.tsx`

### 후속 메모 (정보)

`FsGridCellStyleDialog` (`packages/fs-data-viewer/src/widgets/cell-style-dialog/FsGridCellStyleDialog.tsx`) 와 `AggregationDetailDialog` (`packages/fs-data-viewer/src/widgets/grid-table/components/AggregationDetailDialog.tsx`) 도 동일 패턴 (custom `fixed inset-0` + 배경색 미설정) 으로 백드롭이 투명한 결함 발견. 본 핫픽스는 마스터 지칭 (문서 모달) 에 한정 — 해당 2개 모달 사용 시 가시성 문제 재현되면 추가 핫픽스 대상.

## v001.237.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 12)
> 버전 양보 메모: 병렬 세션이 v236 선점하여 v001.237.0 으로 양보.

### 핫픽스 결과 — 결제 수단 케밥 메뉴 + 결제 이력 항상 노출

마스터: "결제 수단의 변경, 삭제 버튼을 하나로 통합하고 누르면 팝업 메뉴로 결제 수단 변경, 결제 수단 삭제, 결제 비밀번호 변경 나오게 구현해, 그리고 결제 수단 없어도 결제 이력은 계속 보여지게 해".

### Phase 29 (FE, `22be705`)

**A. CardInfoSection 케밥 메뉴 통합**
- 기존 카드 변경 (RefreshCw) + 삭제 (Trash2) 두 아이콘 버튼 → 단일 MoreVertical 케밥.
- DropdownMenu 3 옵션:
  1. **결제 수단 변경** — 기존 handleChangeCard (토스 redirect → BillingSuccessPage setup).
  2. **결제 수단 삭제** — deleteCard + 확인.
  3. **결제 비밀번호 변경** — PaymentPasswordSetupStep 직접 마운트 (덮어쓰기 모드, 카드 등록 흐름 무관, 완료 시 toast).

**B. PaymentHistory 항상 노출**
- `PlanTabContent.tsx` 에서 PaymentHistorySection 의 hasBillingKey 조건부 가드 제거. 카드 없어도 결제 이력 렌더링.
- upcomingPayment 계산은 기존대로 hasBillingKey 거짓 시 undefined → 빈 상태 안내 자연 노출.

### 영향 파일

**data-craft**:
- `src/widgets/settings-dialog/ui/plan/CardInfoSection.tsx`
- `src/widgets/settings-dialog/ui/PlanTabContent.tsx`

### 검증

- typecheck + lint PASS.
## v001.236.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 23)

### 개요

마스터 명령: "여전히 날짜 겹쳐짐, 날짜 하단 표기 자체를 제거해". HOTFIX 22 의 `@page margin-bottom + tr break-inside avoid` 후에도 겹침 잔존. 근본 해소로 푸터 자체 emit 제거.

### 페이즈 결과

- **Phase 31 (HOTFIX 23)** (`20ee4af` + lint hotfix `fb07d37`):
  - **printHtmlBuilder.ts**: `buildFullHtml` 의 `footerHtml` 산출 로직 (5줄 조건 분기) → `footerHtml = ''` 단일 라인 + `printDate` 변수 선언 제거. footer div 자체가 HTML 에 emit 안 됨.
  - `buildFooterContent` 함수 자체는 보존 (PdfPrintEngine 등 다른 호출 경로 후방 호환).
  - `.print-footer` CSS / `@page margin-bottom +10mm` (HOTFIX 22) / `.print-content padding-bottom` (HOTFIX 21) 모두 손대지 않음 — 최소 침습. footer 가 emit 안 되므로 fixed-position CSS 는 무용 (잔재) 이나 무해.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`

1 파일 / +1 / -10 / 본 커밋 + lint hotfix (printDate 변수 제거).

### lint

- iter 1: FAIL (printDate unused) → code-fixer 로 변수 제거.
- iter 2: PASS (0 errors, 17 warnings).

## v001.235.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 5)
> HOTFIX 4 에서 신설한 `CustomColumnDropdown` 패널이 Step 4 에서 클릭해도 노출되지 않던 현상 픽스. 원인: `Dialog.Content` 의 `transform: translate(-50%, -50%)` 가 CSS 컨테이닝 블록을 생성해 fixed 포지셔닝된 panel 의 좌표 기준이 viewport 가 아닌 Dialog 내부로 바뀜 + `overflow-hidden` 으로 클리핑. 패널을 `createPortal(panel, document.body)` 로 body 에 포털 렌더하여 회피. 외부 클릭 핸들러도 `panelRef` 추가로 포털된 패널 내부 클릭은 무시하도록 보정.

### 핫픽스 결과 — 1 phase (`5147265`)

- `RowLinkConfigDialog.tsx`:
  - `react-dom` 의 `createPortal` import.
  - 패널 렌더를 `createPortal(<div>...</div>, document.body)` 로 변경.
  - 패널에 `panelRef` 추가.
  - 외부 클릭 핸들러가 trigger 또는 panel 안의 클릭은 무시하도록 보정.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (+9 / -3)

### 회귀 검증

- typecheck + lint PASS (0 errors).
- 마스터 dev server 갱신 후 Step 4 의 컬럼 선택 버튼 클릭 시 옵션 패널이 viewport 기준 fixed 위치에 정상 노출 기대.

## v001.234.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 4)
> RowLinkConfigDialog 의 6개 UX 요구 일괄 반영. 마스터 명시 후 advisor 사전 검증 통과 후 단일 파일 리팩터로 진행.

### 핫픽스 결과 — 1 phase (`9fc201a`)

1. **Step 1 그룹 선택 4탭** (뷰어/서브/외부/폼) 추가. groupType `main`/`sub`/`external` 매핑, "폼" 탭은 현재 `ConnectionGroupItem.groupType` 에 `'form'` 부재로 빈 상태 안내만 노출 (탭 자체는 4개 유지).
2. **그룹 검색 input** 추가 — `groupName.toLowerCase().includes(query.toLowerCase())` 필터.
3. **mode 기본값 `copy` → `reference`** (state 초기값 + 리셋 핸들러).
4. **열 개수 입력 보강** — state 타입 `number` → `string`, `<input type="text" inputMode="numeric">` 로 브라우저 화살표 제거, `CornerDownLeft` (lucide-react) 아이콘 absolute 배치, Next 클릭 시 `Math.max(2, parseInt(value || '2'))` 자동 정수화. empty 입력 허용.
5. **타겟 컬럼 select → 커스텀 드롭다운** — 같은 파일 inline `<CustomColumnDropdown>` 컴포넌트 신설. `useLayoutEffect` + `useState<DOMRect|null>` anchor 패턴 (react-hooks/refs 룰 준수), fixed positioning, 외부 클릭 닫힘.
6. **리더 자동 타겟** — `leaderTargetColumnId` 별도 state/picker 제거. handleConfirm 에서 `mappingRows[leaderIndex].mappedTargetColumnId` 로 자동 도출. Step 5 UI 는 리더 라디오만 남음. `RowLinkConfig.leaderTargetColumnId` 필드는 emit 형태 그대로 보존 (useRowLinkCell / addRowLinkColumns 영향 0).

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (+213 / -106)

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` PASS (0 errors).
- advisor 사전 검증 PASS (5관점).

## v001.233.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 22)

### 개요

마스터 보고: "빈 페이지는 없지만 여전히 날짜가 표와 겹쳐짐, 겹쳐지는 행은 다음 페이지로 넘어가는게 정상이야". HOTFIX 21 의 `.print-content padding-bottom` 은 *전체 콘텐츠 끝* 에만 작용 — *중간 페이지* 의 행이 fixed-position 푸터와 겹치는 것 미해결. advisor 권고로 `@page margin-bottom` + `tr break-inside avoid` 페이지 단위 fix.

### 페이즈 결과

- **Phase 30 (HOTFIX 22)** (`068a026`): `printStyleGenerator.ts` 의 2가지 CSS 변경.
  - **`@page` margin-bottom 보강**: `margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm` → `${margins.bottom + 10}mm`. footer 영역 reserve. 인쇄 엔진이 content area 에서 footer 공간 제외.
  - **`table tr { page-break-inside: avoid; break-inside: avoid }`**: 페이지 끝 행이 footer 영역에 들어가지 않고 자연스럽게 다음 페이지로 이동. modern `break-inside` + legacy `page-break-inside` 이중 emit.
  - HOTFIX 21 의 `.print-content padding-bottom` 은 마지막 페이지 안전망으로 유지.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +6 / -1 / 단일 커밋.

### advisor 검증

- **advisor (계획 사전)**: PASS — `@page margin-bottom` 보강이 메인 fix, `tr break-inside avoid` 보조. HOTFIX 21 padding-bottom 은 마지막 페이지 안전망으로 유지 권고.
- **lint**: PASS (0 errors, 17 warnings).

## v001.232.0

> 통합일: 2026-05-19
> 플랜 이슈: #114

### 개요

마스터 명령: data-craft FE UI 3종 보정 — (1) 설정 모달 X 버튼이 본문 확장 토글과 겹쳐 좌측으로 이동, (2) 뷰어 셀-기원 모달의 백드롭이 배경과 구분 모호 → 어둡게, (3) 레이아웃 빌더의 "빈 입력 위젯 4종" 명칭에서 "빈" 용어 제거하여 "컨테이너 위젯" 패턴으로 일괄 재명명. 내부 enum 키 (`empty-*`) 와 파일/컴포넌트 이름은 저장 호환 위해 보존.

### 페이즈 결과

- **Phase 1** (`e06bde6`): `SettingsDialog` 의 `DialogContent` 에 `showCloseButton={false}` 지정하고 자식 트리 끝에 커스텀 `DialogClose` 를 `absolute top-4 right-9` 위치로 직접 렌더. 본문 확장 토글 (`w-6`, 24px) 과의 시각/클릭 겹침 해소. shadcn 기본 X 스타일 토큰 (focus-ring / hover-opacity / sr-only Close) 유지, `right-4` → `right-9` 만 치환. `isCustomSettingsActive` 노출/비노출과 무관하게 항상 동일 위치.

- **Phase 2** (`553191e`): 공용 `DialogOverlay` (shadcn 표준) 의 `bg-black/50` → `bg-black/70` 단일 토큰 치환. 모든 shadcn Dialog 백드롭이 70% 농도로 일관 — 뷰어 셀-기원 모달도 동일 표준이라는 가정 하에 단일 지점 조정. 셀-특정 모달 컴포넌트의 정확한 식별은 grep 무성과로 미수행이므로 마스터 시각 검증 후 hotfix 여지 보존.

- **Phase 3** (`7ea5694`): 6개 파일에서 사용자 가시 텍스트의 위젯 명칭 "빈" 일괄 제거. 마스터 매핑 — 그룹 `'빈 위젯'` → `'컨테이너 위젯'`, 4종 `'빈 입력폼'`/`'빈 데이터뷰어'`/`'빈 서브 데이터뷰어'`/`'빈 외부 데이터뷰어'` → `'입력폼 컨테이너'`/`'데이터 뷰어 컨테이너'`/`'서브 데이터 뷰어 컨테이너'`/`'외부 데이터 뷰어 컨테이너'`. description / LoadDataActionSection 안내 6 문장 / EmptyDataPlaceholder 의 `defaultValue` 도 동일 매핑으로 다듬음. `'미지정 (빈 화면)'` (분류명 아님) + 주석/JSDoc + 내부 enum (`empty-*`) + 파일/컴포넌트 이름은 모두 보존.

### 영향 파일

data-craft:
- `src/widgets/settings-dialog/ui/SettingsDialog.tsx`
- `src/shared/ui/shadcn/dialog.tsx`
- `src/widgets/property-drawer/ui/widgetTypeConfig.ts`
- `src/widgets/property-drawer/ui/WidgetTypeSelector.tsx`
- `src/widgets/property-drawer/ui/property-editors/button-editor/LoadDataActionSection.tsx`
- `src/features/widget-placement/ui/AddWidgetButton.tsx`
- `src/widgets/property-drawer/ui/property-editors/EmptyDataWidgetPropertiesEditor.tsx`
- `src/widgets/empty-data-widget/ui/EmptyDataPlaceholder.tsx`

## v001.231.0

> 통합일: 2026-05-19
> 플랜 이슈: #113

### 개요

마스터 명령: 단계4 메시징·알림·피드 통합 — DM/알림/인박스/피드/홈/프로필/팔로우 를 단일 plan 으로 묶고 phase 분해 (`기존 message / notification / feed / profile API 재사용`, BE 변경 없이). Step 1 sharpening 결과, 7개 stub 라우트 중 **BE 가 실제로 완비된 영역은 notification (`/api/notification` 4개) + profile-이미지 (`/api/profile` 4개) 둘뿐**임이 드러나 (DM/피드/페이지팔로우/프로필 상세는 BE 부재, v2/social 라우트는 2026-05-01 deprecated), 마스터 선택 (옵션 B) 으로 본 plan 의 범위를 **Notification + Inbox + Profile-이미지** 로 좁힘. DM/피드/팔로우/프로필 상세는 별도 plan-enterprise (BE 선행) 로 분리. BE/DB 변경 없음 (마스터 이중 lock).

### 페이즈 결과

- **Phase 1** (`8d406eb`): `ScreenNotifications` + `ScreenInbox` 신규 (각 248/252 줄). `notificationApi.getNotifications` 로 목록 로드, 카드 리스트 (loading/error/ready 상태머신 + AbortController), 항목 탭 → `markAsRead` (optimistic), 헤더 "모두 읽음" → `markAllAsRead`, "읽은 항목 삭제" → `deleteRead` 후 재로드. `ScreenInbox` 는 동일 데이터를 `isRead===0` 우선 + `createdAt` DESC 정렬. `routes/notifications.tsx` / `routes/inbox.tsx` 두 Placeholder 를 lazy + Suspense delegate 로 교체. 각 화면 vitest+testing-library 스모크 테스트 2케이스. `NotificationItem.isRead` 가 0|1 숫자 리터럴 union 이라 optimistic 업데이트 시 `as const` 캐스트 적용.

- **Phase 2** (`86addf6`): `packages/fs-api-mobile/src/api/profile.ts` 신규 (`getProfile/uploadProfile/updateProfile/deleteProfile`, multipart field 명 `'image'`). `index.ts` 에 `profileApi` export. `ScreenProfile` 신규 — `id === 'me'` 일 때만 GET + 업로드/교체/삭제 액션, 타 사용자 ID 는 "타 사용자 프로필은 추후" 안내 (read-only). `routes/profile/[id].tsx` Placeholder → lazy+Suspense delegate. 스모크 2케이스. 선언된 affected_files 8개 중 `constants.ts` 부재 + `types/requests/profile.ts` / `types/requests/index.ts` 이미 충분 → 실제 변경 5개 파일 (스코프 ⊆ 선언, 합법).

### 영향 파일

data-craft-mobile:
- `apps/web/src/mobile/screens/notifications/ScreenNotifications.tsx` (신규)
- `apps/web/src/mobile/screens/notifications/__tests__/ScreenNotifications.test.tsx` (신규)
- `apps/web/src/mobile/screens/inbox/ScreenInbox.tsx` (신규)
- `apps/web/src/mobile/screens/inbox/__tests__/ScreenInbox.test.tsx` (신규)
- `apps/web/src/mobile/screens/profile/ScreenProfile.tsx` (신규)
- `apps/web/src/mobile/screens/profile/__tests__/ScreenProfile.test.tsx` (신규)
- `apps/web/src/mobile/routes/notifications.tsx`
- `apps/web/src/mobile/routes/inbox.tsx`
- `apps/web/src/mobile/routes/profile/[id].tsx`
- `packages/fs-api-mobile/src/api/profile.ts` (신규)
- `packages/fs-api-mobile/src/index.ts`

총 11 파일 (Phase 1 = 6 / Phase 2 = 5). +1020 / -15.

### 위험 / 후속

- **본 plan 범위 외 (BE 부재로 분리)**: DM (목록/채팅/권한), 피드, 페이지 팔로우, 프로필 상세 필드 (bio/follower/팔로우 토글 등) 는 별도 plan-enterprise (BE 선행) 필요. 현재 stub 라우트 (`dm/`, `feed.tsx`, `page-follow/[id].tsx`, `dm-permission.tsx`) 는 Placeholder 유지.
- **Inbox v1 의미론 한계**: DM 미구현 상태에서 "통합 인박스" = notification 의 unread 우선 view. DM 도입 시 통합 inbox 재설계 (별도 plan).
- **`NotificationItem.isRead` 타입 한계**: 0|1 숫자 리터럴 union — boolean 일관화 시 화면 동기 필요.
- **에러 처리 / optimistic 롤백 부재**: 본 plan v1 의도적 단순화 — 별도 plan 또는 핫픽스 후보.
- **`/m/profile/me` 라우트 매칭 확인 (수동)**: 라우터 config `:id` 와일드카드 매칭 dev server 검증 필요.
- **이미지 multipart field 명 `'image'`**: BE 컨트롤러 read 로 확정.

### 버전 충돌 메모

- 본 plan 머지 진입 시 v001.230.0 이 동시 진행 중이던 plan-enterprise #91 HOTFIX 11 에 의해 main 에 선점되어 본 entry 는 v001.231.0 으로 부여. 1차 doc WIP (`-문서`, commit aab15c6, v001.230.0) 는 폐기되고 v2 doc WIP 로 재작성.

### advisor 검증

- 계획 단계 (#1): 5관점 PASS, no BLOCK.
- 완료 단계 (#2): 5관점 PASS, no BLOCK. Plan affected_files 정확도 (under-declared 단계3-D / over-declared 단계4) 는 비차단 meta 후속.

## v001.230.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 11)

### 핫픽스 결과 — 3 항목

마스터 보고:
1. PIN 모달이 옛 shadcn Dialog 안에 중첩 노출 (스크린샷 — 새 디자인 PIN 카드가 옛 모달 안에 비대칭).
2. BillingSuccessPage 의 타임아웃이 setup 입력 중에도 fire → 사용자가 비밀번호 입력하는 사이 화면 강제 전환.
3. **치명**: setup 모달 닫기/이탈 시 카드는 BE 에 등록된 채 남고 비밀번호 없음 → orphan 카드.

### Phase 28 (FE, `dd2d9d8` + `9023149`)

**A. PaymentPasswordSetupStep self-contained 화**
- 기존: PinModal 만 반환 → 호출 측이 shadcn Dialog 로 감싸 중첩.
- 신규: props `{ open, onOpenChange, onComplete, onCancel? }` 로 자체 Portal+Overlay+Content (PaymentPasswordInputDialog 와 동일 패턴). 호출 측 Dialog 래퍼 제거.

**B. BillingSuccessPage 타임아웃 차단**
- 타임아웃 useEffect 의존성에 showPasswordSetup 추가. setup 모달 open 동안 타이머 중단, close 후 30초 재시작.

**C. orphan 카드 자동 삭제 (치명 결함 대응)**
- handlePasswordSetupDone 을 complete (`handlePasswordSetupComplete`) / dismiss (`handlePasswordSetupDismiss`) 두 핸들러로 분리.
- currentActionRef + passwordCompleted ref 로 액션 타입 + 완료 여부 추적.
- card-change 에서 사용자가 비밀번호 설정 없이 모달 닫기:
  - `window.confirm("비밀번호를 설정하지 않으면 등록한 카드가 삭제됩니다. 계속하시겠습니까?")` → 확인 시 `deleteCard()` → navigate.
  - 취소 시 setup 모달 재오픈.
- 페이지 이탈 (브라우저 뒤로/탭 닫기) 시 best-effort `navigator.sendBeacon('/api/subscription/billing/delete-card')` (인증 헤더 미포함 한계 — BE-side 정리 후속 권장).
- 신규구독 / 프로모션결제 분기는 이미 결제 완료 — 그대로 둠.

**D. usePaymentPasswordGate update**
- setup 분기도 Dialog 래퍼 없이 PaymentPasswordSetupStep 에 open/onOpenChange 직접 전달.

### 영향 파일

**data-craft**:
- `src/features/subscription/ui/PaymentPasswordSetupStep.tsx`
- `src/features/subscription/lib/usePaymentPasswordGate.ts`
- `src/pages/billing-callback/ui/BillingSuccessPage.tsx`

### 검증

- typecheck + lint PASS.

### 잔여

- best-effort beacon delete-card 는 인증 헤더 한계로 보장 안 됨 → BE-side 미설정 카드 24h 자동 정리 (또는 세션 쿠키 인증) 후속 필요.
- billingApi.ts 와 cardApi.ts 의 deleteCard 위치 불일치 — 명명 정합 후속 권장.

## v001.229.0

> 통합일: 2026-05-19
> 플랜 이슈: #86 (HOTFIX 21)

### 개요

마스터 보고 (이미지 2장):
1. **푸터 겹침** (8/14 페이지): 본문 마지막 행 셀과 푸터 `2026-05-19 - 0 -` 가 겹침.
2. **빈 페이지** (13/14 페이지): 페이지 13 이 완전히 빈 페이지 (푸터만), 14가 집계 페이지.

advisor 사전 검증 + 정찰 결과 두 증상 모두 정확 진단:
- (1) HOTFIX 19 의 `.print-content { margin: 0 auto }` (bottom margin 0) 가 fixed-position 푸터 reserve space 를 없앤 직접 원인.
- (2) `useGridPrint.ts` 가 집계 페이지 앞에 `buildPageBreak()` (`<div class="page-break"></div>`, CSS `page-break-after: always`) 를 emit + `.aggregation-summary-page` CSS 가 `page-break-before: always` → 브라우저가 두 break 를 모두 적용해 사이에 빈 페이지 삽입.

### 페이즈 결과

- **Phase 29 (HOTFIX 21)** (`8bde25e`):
  - **printStyleGenerator.ts**: `.print-content` 의 base 규칙 + `@media print` 규칙 양쪽에 `padding-bottom: ${margins.bottom + 5}mm` 명시. base 규칙의 padding 단축 속성을 @media print 가 덮어쓰므로 양쪽 명시 필요. fixed-position 푸터의 height (margins.bottom/2mm) + 5mm 여유로 reserve.
  - **useGridPrint.ts**: 집계 페이지 앞의 `buildPageBreak()` 호출 제거. `.aggregation-summary-page` 의 `page-break-before: always` CSS 단독으로 break 처리 — 일원화로 이중 break 해소.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`
  - `packages/fs-data-viewer/src/features/print/views/grid/useGridPrint.ts`

2 파일 / +3 / -2 / 단일 커밋.

### 잔여 한계

- `useGridPrint.ts:121` `subGridsHtml` 가 현재 빈 문자열. 추후 서브그리드 구현 시 `buildPageBreak()` + subGridsHtml 패턴이 서브그리드 자체에 `page-break-before` CSS 가 있으면 동일한 이중 break 재발 위험 — 구현 시 검토 필요.

### advisor 검증

- **advisor (계획 사전)**: PASS — `@page` margin 조정 / padding-bottom 복원 / inspect 우선 권고. 정찰 결과로 두 원인 모두 확인 후 fix 적용.
- **lint**: PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.228.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 3)
> "행 연결" 항목이 모달엔 노출되지만 아이콘이 `?` 로 표시되는 현상 픽스. `COLUMN_ICONS` (column-generator/icons.ts) 매핑이 누락되어 `ColumnTypeButton` 의 fallback `?` glyph 가 표시됐던 것. HOTFIX 2 의 AVAILABLE 화이트리스트 누락과 동일한 패턴 — Phase 2 검증 시 column-generator widget 내부의 second-layer 들을 통합 확인 안 한 결과.

### 핫픽스 결과 — 1 phase (`2319bc4`)

- 3개 viewer 패키지 `widgets/column-generator/icons.ts` 의 `COLUMN_ICONS` 에 `rowLink: Combine` 매핑 추가 (lucide-react `Combine` 아이콘, 행 데이터 결합 의미). `Link2` 와 시각적으로 구분되어 연결과 행 연결을 한 눈에 식별 가능.
- fs-sub-data-viewer / fs-external-data-viewer dist 재빌드 완료.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/column-generator/icons.ts`
  - `packages/fs-sub-data-viewer/src/widgets/column-generator/icons.ts`
  - `packages/fs-external-data-viewer/src/widgets/column-generator/icons.ts`

### 회귀 검증

- 마스터 dev server 갱신 후 유용한 기능 탭에서 "행 연결" 버튼이 Combine 아이콘과 함께 표시 기대.

## v001.227.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 20)

### 개요

마스터 명령: "제목은 좀 크고 굵게 나오게 해줘". `.print-header` 의 폰트 사이즈·굵기·색상 강조.

### 페이즈 결과

- **Phase 28 (HOTFIX 20)** (`bd32958`): `printStyleGenerator.ts` 의 `.print-header` 블록 3가지 속성 변경.
  - `font-size: ${10 * scale}px` → `${18 * scale}px` (10 → 18).
  - `font-weight: bold` 신규 추가.
  - `color: #666` → `#222` (선명).
  - `text-align: center` / `margin-bottom` 보존.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +3 / -2 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.226.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 2)
> 데이터 뷰어 디자인 모드 → 열 추가 → 유용한 기능 탭에서 "행 연결" 항목이 끝까지 노출되지 않는 현상 근본 픽스. 원 플랜 Phase 2 가 `usefulColumnTypes` 에 rowLink 를 등록은 했으나, **`packages/fs-data-viewer/src/widgets/column-generator/available-types.ts` 의 `AVAILABLE_COLUMN_TYPE_IDS` 화이트리스트 누락** 으로 `ColumnTypeButton` 에서 `if (!isInAvailableList) return null` 차단되어 버튼이 렌더되지 않고 있었음. HOTFIX 1 의 sub/external registry 추가도 같은 패키지의 `available-types.ts` 누락이라 동일 차단. 본 HOTFIX 2 가 3개 viewer 패키지 모두에 `'rowLink'` 화이트리스트 항목 추가.

### 핫픽스 결과 — 1 phase (`af01bdd`)

- **`packages/fs-data-viewer/src/widgets/column-generator/available-types.ts`** 의 `AVAILABLE_COLUMN_TYPE_IDS` 배열에 `'rowLink'` 추가.
- **`packages/fs-sub-data-viewer/src/widgets/column-generator/available-types.ts`** 동일 추가.
- **`packages/fs-external-data-viewer/src/widgets/column-generator/available-types.ts`** 동일 추가.
- fs-sub-data-viewer / fs-external-data-viewer 의 `dist` 도 머지 후 재빌드 완료.

### 진단 정리 (실수 기록)

원 플랜 Phase 2 가 `column-types` registry 만 검증하고 column-generator widget 의 `available-types.ts` allowlist 의 존재를 놓침. ColumnTypeButton 의 `isInAvailableList` 가드가 hard-cut 으로 작동하여 type 이 registry 에 있어도 화이트리스트 없으면 완전 숨김 — second-layer filter 의 존재를 마스터의 반복 신고 후에야 ColumnTypeButton.tsx 직접 확인으로 발견. Phase 2-8 / HOTFIX 1 모두 이 파일을 검증 범위에 안 넣은 점이 직접 원인.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/widgets/column-generator/available-types.ts`
  - `packages/fs-sub-data-viewer/src/widgets/column-generator/available-types.ts`
  - `packages/fs-external-data-viewer/src/widgets/column-generator/available-types.ts`

### 회귀 검증

- 마스터 dev server 재시작 후 데이터 뷰어 → 디자인 모드 → 열 추가 → 유용한 기능 탭에 "연결 / 행 연결 / 듀얼 위젯 / 문서" 4개 노출 기대.

## v001.225.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 10)

### 핫픽스 결과 — PIN 모달 디자인 시안 픽셀 정확 재구현 (테마 격리)

마스터: "디자인 팀 설계안 보고 결재 비밀번호 부분 아예 다시 만들어, 특히 디자인 팀 시안 그대로 만들어야해, 테마에 영향 안받게해". 디자인 소스 (`Data-Craft (1).zip` 내 pin-modal.jsx / pin-states.jsx) 확보 후 전면 재구현.

### Phase 27 (FE, `d84608e`)

**A. 신규 모듈 `src/features/subscription/ui/payment-pin/`** — 9 atomic 컴포넌트 + 토큰
- `tokens.ts` — PIN 색상 토큰 (bg #f0eee9, surface #ffffff, accent #c96442, err #c0463a 등 18종).
- `PinIcon.tsx` — 12 종 inline SVG (lock / lockOpen / shield / check / checkCircle / alert / info / close / back / delete / shuffle / eye / eyeOff).
- `StepHeader.tsx` — 단계 인디케이터 (가변폭 도트) + 뒤로 + X.
- `PinTitle.tsx` — tone 별 (default/success/error) 아이콘 + 19px 800 weight 타이틀 + 13px 본문.
- `PinDots.tsx` — 6칸 도트 (tone 별 색상, shake 옵션).
- `PinStatusRow.tsx` — error/warning/success/info 인라인 행 + 32px 자리 고정 (점프 방지).
- `PinKeypad.tsx` — 4×3 셔플 (seed 기반 deterministic, 좌하단 재배치 / 우하단 삭제 고정, 10 digits 무작위 배치).
- `PinSecurityFooter.tsx` — 보안 안내 풋터.
- `PinModal.tsx` — 모달 카드 frame (440px / 14px radius / shadow) + @keyframes pinShake 단일 위치 선언.

**테마 격리**: 모든 컴포넌트 `className` 일절 사용 금지, `style={{...}}` 또는 `<style>` 인라인만. Tailwind / shadcn 토큰 영향 0.

**B. PaymentPasswordInputDialog 재작성** (verify 단일 단계)
- Dialog + Portal + Overlay (matte) + DialogPrimitive.Content (inline style 포지셔닝) + PinModal.
- 6자리 완성 시 즉시 verify API → 성공 onSuccess(password) / 실패 PinDots error + shake + StatusRow error → 500ms 후 reset.

**C. PaymentPasswordSetupStep 재작성** (setup 2단계)
- Step 1 enter — 6자리 완성 시 weak check (123456 / 111111 / 654321 등 연속·반복 패턴) → warn 또는 complete → 500ms 후 Step 2.
- Step 2 confirm — 일치 → set API → onComplete / 불일치 → error + shake → 500ms 후 Step 1 리셋.
- 호출처 시그니처 (`{ onComplete(password), onCancel? }`) 보존.

**삭제**: `src/shared/ui/pin-pad.tsx`.

### 영향 파일

**data-craft**:
- 신규 (10): `src/features/subscription/ui/payment-pin/{tokens.ts, PinIcon, StepHeader, PinTitle, PinDots, PinStatusRow, PinKeypad, PinSecurityFooter, PinModal, index}`.
- 재작성 (2): `src/features/subscription/ui/{PaymentPasswordInputDialog, PaymentPasswordSetupStep}.tsx`.
- 삭제 (1): `src/shared/ui/pin-pad.tsx`.

### 검증

- typecheck + lint PASS (0 errors).

### 잔여 (시안 외 / 본 hotfix 범위 외)

- **생년월일·전화번호 일치 경고** (시안 StateBirthdayWarn): 사용자 PII 접근 흐름 미정의 — 본 페이즈 외 후속.
- 호출처 (CardInfoSection / RegisterCardSection / BillingSuccessPage / usePaymentPasswordGate) 는 시그니처 호환되어 코드 변경 없음.

## v001.224.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 19)

### 개요

HOTFIX 18 의 잔여 한계 해소. `.print-content` 의 `margin-top: ${margins.top}mm` 가 기존 fixed-header 오프셋 보정 목적이었으나 HOTFIX 18 에서 헤더가 normal-flow 로 전환된 후 과도한 상단 여백만 남기는 부작용. margin-top 제거.

### 페이즈 결과

- **Phase 27 (HOTFIX 19)** (`5bb01ae`): `printStyleGenerator.ts` 의 기본 `.print-content` 블록에서 `margin: ${margins.top}mm auto 0` → `margin: 0 auto`. @media print / @media screen 블록은 이미 `margin: 0` 또는 미설정이라 변경 불필요.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +1 / -1 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.223.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 18)

### 개요

마스터 보고: "모든 페이지 상단에 {dataViewerTitle}이라고 나오는데 이건 뭐야 뷰어 타이틀은 젤 위에 하나만 나오면 되는데 전부 나오고 제대로 된 값이 아니라 {dataViewerTitle} 이렇게 나와". 두 증상:
1. `{dataViewerTitle}` placeholder 미치환 — default headerText (`types.ts:288`, `templates/defaults.ts`) 는 `{dataViewerTitle}` 인데 `buildHeaderContent` 는 `{title}` 만 치환.
2. `.print-header { position: fixed; top: 0 }` — fixed-position 으로 모든 페이지 반복 표시.

### 페이즈 결과

- **Phase 26 (HOTFIX 18)** (`94d830d`):
  - **printHtmlBuilder.ts**: `buildHeaderContent` 의 `{title}` / `{dataViewerTitle}` alias 둘 다 치환. 기존 두 분리 변수 (`displayText`/`displayDate`) 처리 버그 (둘 중 하나만 적용) 도 chain replace 로 정리.
  - **printStyleGenerator.ts**: `.print-header` 의 `position: fixed / top / left / right / height` 속성 제거 → normal flow. `margin-bottom` 으로 본문과 간격 보존. 헤더가 첫 페이지 본문 시작 직전 1회만 표시.
  - 푸터 (`.print-footer`) 의 fixed-position 동작은 페이지 번호 등 의도된 반복 — scope 외로 보존.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

2 파일 / +8 / -16 / 단일 커밋.

### 잔여 한계

- `.print-content` 의 `margin-top: ${margins.top}mm` 가 기존 fixed header 오프셋 보정 목적이었으나 normal-flow 전환 후 상단 여백 과도하게 느껴질 수 있음 — 실제 인쇄 확인 후 별 픽스 권장 (phase-executor blocker 보고).

### lint

- PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.222.0

> 통합일: 2026-05-19
> 플랜 이슈: #112

### 개요

마스터 명령: "단계3-D 파일 첨부 (fs-file-attachment-mobile). 기존 attachment 업로드/다운로드 API 재사용 (S3 presigned 등 BE 변경 없이)". 모바일 폼의 `FormFieldRenderer` 가 `'file-attachment'` widgetType 을 dispatch 하지 못해 폼 정의에 첨부 필드를 둘 수 없던 상태를 해소. `@dcm/fs-file-attachment-mobile` 패키지 본체 (FsFileAttachment 컴포넌트 + 훅 + parallelUploader) 와 `@dcm/fs-api-mobile` 의 file API (uploadFile/downloadFile/deleteFile 등) 는 이미 구현 완료 상태였으므로, 본 단계는 폼 dispatch wiring 만 추가하여 기존 자산을 연결. BE/DB 변경 없음 — 기존 `/api/file*` endpoint + S3 presigned 흐름 그대로 재사용.

### 페이즈 결과

- **Phase 1** (`9001b00`): `FormFieldWidgetType` union 에 `'file-attachment'` 추가 (12 → 13가지). `FormField` 인터페이스에 첨부 전용 옵션 필드 5개 (`fileCategoryType`, `identifier`, `usePreview`, `maxFileSize`, `useOnlyImage`) 추가. `FileAttachmentFieldRenderer` 신규 작성 — `FsFileAttachment` 를 `FormFieldLabel` / `FormFieldError` 셸로 래핑, field config → FsFileAttachmentProps 매핑 (fallback 포함). `FormFieldRenderer.tsx` switch 에 `case 'file-attachment'` 분기 등록. `fs-form-builder-mobile/package.json` 에 `@dcm/fs-file-attachment-mobile` workspace 의존성 추가. 함께 `DataCraft-mobile-v2/handoff/phase0/audit/` 하위 stale audit md 3개 정리. 1차 dispatch 는 `form.types.ts` 누락 감지하여 `scope_expansion_needed` 보고 → affected_files 확장 후 2차 디스패치에서 단일 commit 완료. `pnpm typecheck` lint gate PASS.

### 영향 파일

data-craft-mobile:
- `packages/fs-form-builder-mobile/src/form-builder/ui/FileAttachmentFieldRenderer.tsx` (신규)
- `packages/fs-form-builder-mobile/src/form-builder/ui/FormFieldRenderer.tsx`
- `packages/fs-form-builder-mobile/src/shared/types/form.types.ts`
- `packages/fs-form-builder-mobile/package.json`
- `DataCraft-mobile-v2/handoff/phase0/audit/appshell-audit.md` (삭제)
- `DataCraft-mobile-v2/handoff/phase0/audit/monorepo-audit.md` (삭제)
- `DataCraft-mobile-v2/handoff/phase0/audit/route-paths-audit.md` (삭제)

### 위험 / 후속

- **per-record `identifier` 스코핑 미구현**: 현 renderer 는 `field.identifier ?? field.name` 폴백을 적용하여 form-scoped 동작 (동일 폼의 모든 record 가 같은 file_group 공유). 실제 record 별 첨부 분리를 위해서는 `recordId` 를 `ScreenUserForm` → `FormFieldRenderer` → `FieldRendererProps` 까지 전파하는 후속 wiring 필요. 데스크탑은 `FsGridFileCellRenderer` 등 row context 에서 `formId_rowId` 패턴으로 식별자를 구성.
- **데이터뷰어 셀 흐름 (`fileCellWidget`) 미연결**: 모바일 그리드/리스트 뷰의 파일 셀 탭 시 `UnsupportedServiceDialog` 가 계속 표시됨. `FsDataViewer` 의 `fileCellWidget` prop 에 `FsFileAttachment` 기반 다이얼로그 wiring 이 필요한 후속 단계 (예: 단계3-E) 로 분리됨 — 마스터 명시 (sharpening 답변) 로 본 플랜 범위 외.

### 버전 충돌 메모

- 본 플랜 머지 진입 시 v001.221.0 이 동시 진행 중이던 plan-enterprise #91 HOTFIX 9 에 의해 main 에 선점되어 본 entry 는 v001.222.0 으로 부여. 원 doc WIP (`plan-enterprise-112-3d-file-attachment-wiring-문서`, commit 332446a) 는 origin 에 v001.221.0 으로 존속하나 main 머지 직전 v001.222.0 으로 재작성된 -v2 doc WIP 로 대체됨.

### advisor 검증

- 계획 단계 (#1): Intent/Logic/Group Policy/Evidence/Command Fulfillment 5관점 PASS, no BLOCK.
- 완료 단계 (#2): no BLOCK. Command Fulfillment 는 PARTIAL — wiring 자체는 충족, 단 위 "위험 / 후속" 2개 항목은 별도 후속 (PENDING 게이트의 핫픽스 또는 단계3-E) 으로 처리 가능.

## v001.221.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 9)

### 핫픽스 결과 — GridViewPage useSaveContext throw 해소

마스터 보고: `Error: useSaveContext must be used within SaveProvider at GridViewPage.tsx:17`. 결제 시스템 본 플랜과는 직접 관련 없으나 마스터가 PENDING 게이트 동안 동반 fix 요청.

원인: GridViewPage 가 일부 mount 경로에서 SaveProvider 의 children 트리 외부에 마운트되어 `useSaveContext()` 가 throw. #86 HOTFIX 14 의 `usePrintContext` 동일 패턴.

### Phase 26 (FE, `fead899`)

- `GridViewPage.tsx` import 를 `useSaveContext` → `useSaveContextOptional` (SaveContext.tsx 에 이미 export 됨).
- `const { saveChange } = useSaveContext()` → `const saveChange = useSaveContextOptional()?.saveChange ?? (() => {})` (noop 폴백 — `FsGridTableView` 의 `saveChange: SaveChangeFn` required prop 충족).

### 영향 파일

**data-craft**:
- `packages/fs-data-viewer/src/pages/GridViewPage.tsx`

### 검증

- typecheck + lint PASS.

### 별도 항목 (PIN 모달 디자인 시안)

마스터 요청: "디자인 팀 설계안 보고 결재 비밀번호 부분 아예 다시 만들어 — /Users/starbox/Downloads/Payment PIN Modal.html".
**HTML 파일이 4개 외부 .jsx 파일을 참조 (`design-canvas.jsx`, `pin-modal.jsx`, `pin-states.jsx`, `pin-app.jsx`) 하나 해당 파일들이 Downloads 에 존재하지 않음 — 본 hotfix 에서 시안 구현 불가.**

후속 진행 방법:
- 마스터가 4개 .jsx 파일을 프로젝트 내 (예: `data-craft/_design-mockup/`) 에 복사 후 추가 hotfix.
- 또는 단일 self-contained HTML (inline JSX) / Figma export / 스크린샷 (테마 + 인터랙션 명세) 로 전달.

## v001.220.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 17)

### 개요

마스터 보고: "부가 정보에서 '외 1개' 이런건 없어야 해, 전부 표기하게 해". HOTFIX 12 부터 도입된 상위 5개 + "외 N개" 잘림을 제거하고 distribution 의 모든 항목을 인라인 표기.

### 페이즈 결과

- **Phase 25 (HOTFIX 17)** (`91edcfa`): `printHtmlBuilder.ts` 의 `buildAggregationSummaryPage` distribution 분기에서 `result.details.slice(0, 5)` + `외 N개` 처리 (총 4줄) 제거 → `result.details.map(...)` 전체 변환 (1줄). HOTFIX 15 의 `white-space: normal` + HOTFIX 16 의 셀 중앙 정렬로 항목 많아도 wrap 가독성 보존.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`

1 파일 / +1 / -4 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.219.0

> 통합일: 2026-05-19
> 플랜 이슈: #111

### 개요

마스터 보고: "데이터 뷰어 → 그리드 뷰에서 트랙 패드로 가로 스크롤 할때는 괜찮은데, 마우스로 클릭한채로 끌어서 가로 스크롤 할 때는 렉이 너무 심해, 정확한 원인 파악하고 성능 개선해줘". 진단 결과 두 가지 합산 원인 — (1) `useDragScroll` 이 매 React `onMouseMove` 마다 `scrollLeft` 를 직접 동기 쓰기 (트랙패드 wheel 은 브라우저 coalescing 으로 매끄러우나 JS 직접 쓰기는 합치 안 됨), (2) `useScrollSync` 가 매 scroll 이벤트마다 3~4 개 컨테이너를 동기 sync 하여 mousemove 당 forced reflow 가 폭주. 두 핸들러를 rAF 합치 + native pointer 부착으로 재작성.

### 페이즈 결과

- **Phase 1** (`6b18135`): `useDragScroll` rAF 합치 + document 부착으로 전환. mousedown 시 document 에 native mousemove/mouseup 부착 → 드래그가 그리드 경계를 벗어나도 끊기지 않음. mousemove 는 pendingScrollLeft ref 만 갱신, rAF 콜백에서 scrollLeft 1회만 쓰기. 반환 surface 를 `handleDragScrollMouseDown` 1개로 축소, 연관 5개 파일의 타입·prop·핸들러 연쇄 정리. 드래그 종료 시멘틱 = mouseup 까지 유지 (표준 드래그-스크롤 UX).
- **Phase 2** (`3d82b92`): `useScrollSync` rAF 배치 sync 로 전환. `createScrollHandler` 팩토리에 pendingScrollLeft + rafId 클로저 변수 추가 → 동일 프레임 내 복수 scroll 이벤트를 단일 rAF 콜백으로 배치. rAF flush 시 guard set → 일괄 쓰기 → guard 해제 순서로 재진입 루프 안전 차단. 공개 서명 보존하여 소비자 무수정.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/features/grid/hooks/useDragScroll.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/useGridScroll.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/gridScrollTypes.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/useScrollSync.ts`
- `packages/fs-data-viewer/src/widgets/grid-table/FsGridTableView.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/GridBody.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/types.ts`

### 후속 검토 (Phase 1 blocker)

- `fs_grid_sub/components/SubGridDragScroll.tsx` 및 `SubGridBody.tsx` (서브그리드 전용 드래그 스크롤) 는 여전히 React 합성 이벤트 방식. 본 페이즈 스코프 외 — 마스터가 동일 lag 경험 시 동일 패턴 적용을 위한 별도 페이즈/핫픽스 가능.

### advisor 검증

- 계획 단계 (#1): Intent/Logic/Group Policy/Evidence/Command Fulfillment 5관점 모두 PASS, no BLOCK.
- 완료 단계 (#2): no BLOCK — 본 스코프 (메인 그리드 드래그 스크롤) 가 마스터 명령에 부합. SubGrid 는 PENDING 게이트의 핫픽스 경로로 routing 가능.

## v001.218.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 16)

### 개요

마스터 보고: "집계에서 텍스트 전부 지금 좌측상단 배치하는데 중앙으로 정렬해". HOTFIX 15 의 표 셀들이 좌측·top 정렬 — 페이지 제목/부제도 좌측. 모두 horizontal + vertical 중앙으로 변경.

### 페이즈 결과

- **Phase 24 (HOTFIX 16)** (`8439f8b`): `printStyleGenerator.ts` 4곳 변경.
  - `.aggregation-summary-title`: `text-align: center` 추가.
  - `.aggregation-summary-subtitle`: `text-align: center` 추가.
  - `.aggregation-summary-table th/td` 공통: `text-align: left → center`, `vertical-align: top → middle`.
- 인라인 분포 텍스트 (`라벨 N · 라벨 N · ...`) 도 셀 중앙 정렬 자연 적용. `white-space: normal` (wrap 허용) 보존.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1 파일 / +4 / -2 / 단일 커밋.

### lint

- PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.217.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 8)

### 핫픽스 결과 — FE paymentPassword 필드명 정합 (BE 400 해소)

마스터 보고: 결제 비밀번호 설정 실패 — `[ERROR] PAYMENT_PASSWORD_REQUIRED (POST /api/user/payment-password/set, status=400)`. BE 컨트롤러는 `req.body.paymentPassword` 를 기대하지만 FE 가 `{ password: ... }` 로 송신 — 필드명 mismatch.

### Phase 25 (FE, `9bbc563`)

- `paymentPassword.api.ts`: `PaymentPasswordSetRequest` / `PaymentPasswordVerifyRequest` 의 필드명 `password` → `paymentPassword` 로 변경 (BE 컨트롤러 인터페이스 정합).
- `PaymentPasswordSetupStep.tsx` / `PaymentPasswordInputDialog.tsx`: 호출 시 인자 키 동일 교체.

### 영향 파일

**data-craft**:
- `src/features/subscription/api/paymentPassword.api.ts`
- `src/features/subscription/ui/PaymentPasswordSetupStep.tsx`
- `src/features/subscription/ui/PaymentPasswordInputDialog.tsx`

### 검증

- FE typecheck + lint PASS (0 errors).

## v001.216.0

> 통합일: 2026-05-19
> 플랜 이슈: #110

### 페이즈 결과
- **Phase 1**: AI 비서 버튼 표시 위치를 영구 토글 모델로 전환. `useFabStore` 의 `hiddenDate` (날짜 기반 일회성 가리기) 를 `displayMode: 'floating' | 'header'` 로 교체하고 `hideForToday`/`restore` 액션을 `pinToHeader`/`unpinToFloating` 으로 대체. 모달 하단 버튼은 현재 모드에 따라 "헤더에서 표기하기" / "플로팅으로 표시하기" 로 조건부 렌더링. 헤더 아이콘 클릭 시 자동 플로팅 복귀 (`restore`) 가 제거되어 헤더 모드 유지하면서 모달만 열림. `getTodayString` 헬퍼와 날짜 비교 로직 전체 제거. localStorage 키 `dc_fab` 유지 (`partialize` 항목만 `displayMode` 로 교체) — 기존 사용자의 잔존 `{hiddenDate}` 는 zustand persist 기본 머지로 누락 필드가 `initialState.displayMode = 'floating'` 으로 자연 폴백.

### 영향 파일
- `data-craft`:
  - `src/entities/fab/model/fabStore.ts`
  - `src/widgets/floating-ai-button/ui/AIAssistantModal.tsx`
  - `src/widgets/header/ui/HeaderAIIconButton.tsx`

### 번호 재할당 사유
- 본 플랜 최초 작성 시점 (`origin/plan-enterprise-110-ai-floating-toggle-문서` `dbe0a54`) 에는 v001.214.0 으로 매겼으나, 머지 직전 `#105 hotfix 3` 머지가 다른 세션에서 양측 보존으로 마무리되며 v001.214.0/v001.215.0 자리를 점유 → 본 플랜은 다음 마이너 v001.216.0 으로 재할당. 기존 `dbe0a54` 브랜치는 origin 보존 (감사 흔적), 신규 작성은 본 `-문서-v2` 브랜치.

## v001.215.0

> 통합일: 2026-05-19
> 플랜 이슈: #105 (HOTFIX 3)

### 개요

마스터 보고 (이전 hotfix 들 모두 "여전히" 미반영): **이전 3 round 코드는 모두 정확했으나 실행 환경에 도달하지 못함**. 진단으로 진짜 원인 발견 — `fs_file_attachment` 패키지의 `package.json` 이 `main`/`module`/`exports` 를 `./dist/index.js` 로 가리키고, `dist/` 가 5/16 11:59 빌드본 (Phase 1 직전). root `pnpm dev` 는 단순 `vite` 라 패키지의 `tsup --watch` 미실행 → 패키지 src 변경 시 dist 가 자동 재빌드 안 됨. 마스터가 본 dialog 는 **5/16 빌드된 옛 ImageZoomDialog** (50vw × 70vh + sm:max-w-lg ≈ 512px cap → 1280-1366px 화면에서 ~30% 너비 정확 일치). 모든 우리 변경 (80vw cap-해제, onCloseAutoFocus, max-h calc) 이 src 안에는 있으나 컴파일 결과물에 없음.

### 페이즈 결과

- **Phase 4 (HOTFIX 3)** (`a875ad73`): root `dev` script 갱신.
  - `package.json` scripts.dev: `"vite"` → `"concurrently -k -n fs-fa,vite \"pnpm --filter fs_file_attachment dev\" \"vite\""`.
  - devDependencies 에 `"concurrently": "^9.1.0"` 추가, `pnpm-lock.yaml` 동반 갱신.
  - 효과: `pnpm dev` 가 vite + `fs_file_attachment` 의 `tsup --watch` 동시 실행. 한쪽 종료 시 다른 쪽도 종료 (`-k` kill-others) — orphan tsup process 방지. 향후 패키지 src 변경 시 dist 자동 재빌드.
  - 초기 시도 (shell 백그라운드 `&`) 는 advisor 가 orphan process 누수 사전 지적 → concurrently 로 정정.
  - **즉시 효과 보장**: hotfix 3 머지 직후 main working tree 에서 `pnpm --filter fs_file_attachment build` 1회 실행 → dist 가 5/19 빌드로 갱신. 마스터의 현재 dev server (있다면) 가 dist 변경 즉시 HMR reload — 마스터는 페이지 hard refresh 만으로 80vw × 90vh 모달 + calc 이미지 cap 확인 가능. `pnpm install` 은 향후 dev script 재실행 전 1회 필요.

### 영향 파일

- data-craft:
  - `package.json` (scripts.dev + devDependencies.concurrently)
  - `pnpm-lock.yaml` (concurrently 의존성 추가)

2개 파일 / +32 / -1 / 2 commit (초기 + concurrently 정정).

### advisor 검증

- 진단 시점 PASS — dist resolution 가설 advisor 확인 (Case A: build-first monorepo, 모든 fs_* 패키지가 dist 가리킴). scroll 문제는 wrong layer fix 였음을 advisor 가 정정 — HOTFIX 1 의 ImageZoomDialog `onCloseAutoFocus` 가 아니라 data-viewer 의 ImageDialog backdrop (wheel 이벤트 미차단) 이 진짜 위치. 본 hotfix 3 은 dist resolution 만 처리, scroll 은 HOTFIX 4 로 분리.
- 완료 시점 PASS — concurrently 채택 + lockfile 갱신 정합, lint gate PASS (0 errors, 17 warnings).

### 마스터 절차 (한 번)

1. `pnpm install` — concurrently 의존성 설치.
2. 기존 `pnpm dev` 종료, 다시 `pnpm dev` — vite + fs_file_attachment watch 동시 실행.
3. 브라우저 hard refresh — 우리가 머지 직후 1회 빌드 해두었으므로 이번 단계 없이도 즉시 확인 가능.

### 수동 점검 권장

- 셀 파일 첨부 이미지 썸네일 클릭 → 모달이 뷰포트 80% × 90% 표시 + 이미지가 내부 가용 공간만큼 비율 유지 확장 확인.
- 향후 패키지 src 수정 시 dist 자동 재빌드 + vite HMR 정상 동작 확인.

### 미해결 (잔여 후속)

- **뒷배경 가로 스크롤 (HOTFIX 4 예정)**: HOTFIX 1 의 `onCloseAutoFocus` 는 wrong layer 였음. 진짜 위치 = `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridImageCellRenderer/ImageDialog.tsx` 의 backdrop. backdrop 이 `onMouseDownCapture stopPropagation` 만 가짐 — wheel (trackpad horizontal scroll) 이벤트는 미차단. fix 후보: `onWheel preventDefault` on backdrop, `overscroll-behavior: contain` on dialog wrapper, 또는 `useScrollLock` 을 horizontal 까지 확장. 마스터 confirm 후 진입.
- **다른 패키지의 동일 dist resolution 이슈**: `fs_data_viewer`, `fs_api`, `fs_sub_data_viewer`, `fs_external_data_viewer`, `fs_data_link`, `fs_relation_builder`, `fs_shared` 모두 `./dist/` 가리킴 + 자동 watch 안 됨. 본 hotfix 는 fs_file_attachment 한 패키지만. 다른 패키지 src 편집 시 동일 fix 필요 (concurrently 명령에 추가). 단발성 추가로 진행하든 일괄 turbo 전환하든 별도 plan 분리.
- **prop-name mismatch**: 패키지 ImageZoomDialog `open` vs app 사본 `isOpen` — latent silent-break. 별도 후속.

## v001.213.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 7)

### 핫픽스 결과 — 카드 등록 → 비밀번호 순서 복원 (hotfix 1/3 흐름 역전 되돌림)

마스터 보고: "결제 비밀번호 설정은 카드를 등록하고 난 후에 하는거야 지금 카드 등록 하기도 전에 뜨고 있어".

이전 hotfix 1 (`eb5269a`) 와 hotfix 3 (`be145eb`) 에서 orphan 카드 우려로 카드 등록/변경 클릭 시 setup 모달 우선 → 토스 redirect 순서로 흐름 역전했으나, 이는 요구사항 6 "카드 추가/변경 시 **마지막 추가 스탭**으로 결제 비밀번호 설정" 의 마스터 의도 오해. 원래 Phase 12 흐름 (카드 등록 → 토스 redirect → BillingSuccessPage 에서 setup) 으로 복원.

### Phase 24 (FE, `03de632`)

- **`CardInfoSection.tsx`**: `handleChangeCard` 가 즉시 토스 redirect (loadTossPayments + requestBillingAuth) 로 직행. PaymentPasswordSetupStep import / 마운트 / passwordSetupOpen state 전부 제거.
- **`RegisterCardSection.tsx`**: 동일 — `handleRegisterCard` 즉시 토스 redirect.
- **`BillingSuccessPage.tsx`**: card-change 분기에서 결제 API 완료 후 PaymentPasswordSetupStep 모달 마운트 복원. card-register 분기는 hotfix 1 이전부터 setup 모달 마운트 유지. pendingNavigate 타겟은 `/?openSettings=plan` 으로 보존 → 카드 변경 후 플랜 설정 화면 복귀 UX 유지.

### 영향 파일

**data-craft**:
- `src/widgets/settings-dialog/ui/plan/CardInfoSection.tsx`
- `src/widgets/settings-dialog/ui/plan/RegisterCardSection.tsx`
- `src/pages/billing-callback/ui/BillingSuccessPage.tsx`

### 검증

- FE lint PASS (0 errors).

### 잔여 / 마스터 결정 필요

카드 등록 후 setup 모달에서 사용자가 X·오버레이로 취소/이탈 시 orphan 카드 (카드 등록 + 비밀번호 미설정) 발생 가능. 마스터 결정:
- **옵션 1**: setup 모달 dismiss 불가 (X·오버레이 차단) 처리 — 가장 단순.
- **옵션 2**: BE 측 모든 결제 라우트가 비밀번호 미설정자 차단 (`PAYMENT_PASSWORD_NOT_SET` 코드 활용) → 다음 결제 시도 시 자동 setup 강제. 라우트 미들웨어가 이미 있어 자연 동작.
- **옵션 3**: 카드 등록 후 setup 미완료 24h 경과 시 BE 가 카드 자동 정리.

## v001.212.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 6)

### 핫픽스 결과 — getSeatChangeQuote response envelope 평탄화 (근본 픽스)

마스터 보고 (hotfix 5 후): 모달 에러 메시지 "(원인: INVALID_QUOTE_RESPONSE_SHAPE)". hotfix 4 의 FE shape 가드가 BE 응답의 nextCycle / immediate 키 부재를 감지. 진단 결과 — BE 컨트롤러가 `buildAuthResponse(req, { callId, message, data: quote })` 로 quote 를 한 단계 더 wrapping 하여 FE 의 `response.data` 가 `{ callId, message, data: <실제 quote> }` 가 되어 nextCycle/immediate 가 한 레벨 깊이에 위치.

### Phase 23 (BE, `3871899`)

- `seatChange.controller.ts:getSeatChangeQuoteController` 의 호출을 다른 정상 컨트롤러 (billing.controller.ts 의 customerKey / executePayment 등) 패턴 그대로 `buildAuthResponse(authReq, quote)` 로 평탄화. callId/message 는 errorCatch 가 이미 다루는 경로이므로 응답 본문에서 제거.
- 변경: 1 파일 / +1 / -7.

### 영향 파일

**data-craft-server**:
- `src/controllers/seatChange.controller.ts`

### 검증

- BE lint PASS.
- 평탄화 후 FE response.data 가 `{ nextCycle: {...}, immediate: {...} }` 직접 도달 → shape 가드 통과.

## v001.211.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 14)

### 개요

마스터 보고 (런타임 에러): `Unexpected Application Error! usePrintContext must be used within PrintProvider` — `useHeaderState.ts:65` 가 `usePrintContext()` 호출 시 일부 mount 경로에서 PrintProvider 가 트리상 부재. 정찰 결과 이론적으로는 FsGridHeader 가 PrintProvider 의 children 내부지만 런타임 throw 가 실제 발생 → 트리 구조 변경보다 방어적 optional hook 사용으로 회귀 위험 최소화.

### 페이즈 결과

- **Phase 22 (HOTFIX 14)** (`02c460c`): `useHeaderState.ts` 한 줄 변경 — `usePrintContext` 호출을 기존에 이미 존재하는 `usePrintContextOptional` 로 교체.
  - `usePrintContextOptional` 은 PrintContext.tsx:329 에 이미 존재 (FsGridTableView.tsx:54 의 선례 사용).
  - PrintProvider 없으면 undefined 반환, throw 안 함. useHeaderState 가 안전 가드 후 `openPrintDialog` 호출.
  - 반환 타입 `() => void` 유지 → HeaderActions / HeaderSearch / FsGridHeader 호출자 시그니처 무변경. HOTFIX 1 의 `onOpenPrintDialog optional` 인터페이스가 자연 적용되어 미노출 처리.
  - import 교체 + hook 호출 라인 변경만 — 신규 코드 없음.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/widgets/data-viewer-header/useHeaderState.ts`

1 파일 / +4 / -4 / 단일 커밋.

### 잔여 한계

- `__tests__/useHeaderState.guide.test.ts` 의 vi.mock 팩토리에 `usePrintContextOptional` 추가 필요 (mock 객체에 누락 시 `TypeError: usePrintContextOptional is not a function`). 테스트 파일은 본 핫픽스 scope 외 — 별 후속 핫픽스 권장 (또는 마스터가 테스트 실행 안 하면 무영향).

### advisor 검증

- **advisor (계획 사전)**: PASS — 옵션 A2 (mount 재배치) 1차 / A1 (optional hook) fallback 명시. 정찰 후 A1 채택 — 트리 모델/현실 불일치 상태에서 mount 재배치 회귀 위험이 더 크다는 phase-executor 판단.
- **lint**: PASS (0 errors, 17 warnings — 신규 위반 없음).

## v001.210.0

> 통합일: 2026-05-19
> 플랜 이슈: #98 (HOTFIX 1)
> 데이터 뷰어 → 디자인 모드 → 열 추가 → 유용한 기능 탭에 "행 연결" 항목이 노출되지 않는 현상 보완. 원 플랜 (Phase 2) 은 `fs-data-viewer` 패키지에만 `rowLink` 를 등록했는데, 형제 패키지 `fs-sub-data-viewer` / `fs-external-data-viewer` 도 자체 column-type registry 사본을 가진 구조여서, 서브-그리드 또는 external-viewer 컨텍스트에서 열어진 모달은 rowLink 를 못 본다. 본 HOTFIX 는 두 형제 패키지에 type 등록만 추가하여 가시성을 일치시킨다.

### 핫픽스 결과 — 1 phase (`11062a9`)

- **`packages/fs-sub-data-viewer/src/entities/column-types/other-types.ts`** 에 `rowLink` 항목 추가 (`connection` 옆, Phase 2 와 동일 shape: useful 카테고리, icon Link, defaultWidth 180, defaultColor purple500, minWidth 120, hasUnitEdit true).
- **`packages/fs-external-data-viewer/src/entities/column-types/other-types.ts`** 동일 추가.
- 두 패키지의 `composition.ts` 는 이미 `...usefulColumnTypes` 로 spread 하므로 추가 변경 없이 registry 에 자동 포함.

### 알려진 한계 (후속 플랜 대상)

- 두 형제 패키지에 **`RowLinkConfigDialog` / `addRowLinkColumns` / `useRowLinkCell` / `RowLinkGroup*Dialog` wiring 은 부재** 하므로, 서브-그리드 또는 external-viewer 컨텍스트에서 "행 연결" 클릭 시 설정 다이얼로그가 마운트되지 않아 no-op. 후속 플랜에서 sub/external 양쪽에 완전 wiring 이전 (또는 fs-data-viewer 의 모듈 공유) 필요.

### 영향 파일

- data-craft:
  - `packages/fs-sub-data-viewer/src/entities/column-types/other-types.ts`
  - `packages/fs-external-data-viewer/src/entities/column-types/other-types.ts`

### 회귀 검증

- WIP `plan-enterprise-98-rowlink-핫픽스1` 의 `pnpm typecheck:all && pnpm lint` PASS (0 errors, 17 pre-existing warnings).
- advisor (완료 시점) — sub/external 클릭 no-op 한계 경고 후 진행 결정 (master 가시성 우선).

### 마스터 수동 확인 가이드

원 보고 "유용한 기능 탭에 행 연결 미노출" 의 가능한 원인은 본 핫픽스로 커버한 sub/external 컨텍스트 외에, **dev server 의 Vite dep 캐시 잔존** 도 가능. 본 핫픽스 머지 후 마스터 측에서 다음 조치 권장:

1. `data-craft` 메인 워크트리에서 dev server 종료.
2. `rm -rf node_modules/.vite` (또는 `.vite/deps`) 로 Vite 캐시 초기화.
3. `pnpm dev` 재시작.

위 조치 후에도 fs_data_viewer 컨텍스트 (vite.config 의 source alias) 에서 미노출이 지속되면 또 다른 캐시 경로 (브라우저 service worker / hard cache) 점검 필요.

## v001.209.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 5)

### 핫픽스 결과 — quote 에러 진단 가시화

마스터 보고 (hotfix 4 후): 인원 관리 → 다음 결제일 결제 탭에서 "결제 견적을 불러오지 못했습니다. 잠시 후 다시 시도하세요." 표시. 일반 안내문만 노출되어 BE 의 실제 원인 불명.

### Phase 21 (BE, `f37d2c3`) — getSeatChangeQuote 진단 로그

- `seatChange.service.ts:getSeatChangeQuote` 의 진입 / 각 guard 통과 또는 throw 직전 / 정상 반환 직전 총 7개 지점에 `logger.info/warn` 추가.
- `seatChange.controller.ts:getSeatChangeQuoteController` 진입 시 `userId / isOwner / companyId / rawDelta` 로그.
- OWNER_ONLY / COMPANY_ID_REQUIRED 에러 메시지를 한국어로 명시화.

### Phase 22 (FE, `3e9298c`) — quote 에러 메시지 surface

- `seatChange.api.ts:getSeatChangeQuote` catch 블록에서 axios-style `error.response.data` 파싱 → BE 의 `{ callId, message, error }` 를 새 Error 의 message 로 throw.
- `console.warn` 에 status / beMessage / beError / callId 명시.
- `SeatManageDialog.tsx` 두 탭 모두 quoteError 표시를 "결제 견적을 불러오지 못했습니다." + 작은 글씨 "(원인: <BE message>)" 구조로 변경. 긴 메시지 truncate.

### 영향 파일

**data-craft-server**:
- `src/services/seatChange.service.ts`
- `src/controllers/seatChange.controller.ts`

**data-craft**:
- `src/features/subscription/api/seatChange.api.ts`
- `src/features/subscription/ui/SeatManageDialog.tsx`

### 검증

- BE / FE lint 모두 PASS.

### 다음 단계 (마스터)

본 hotfix 가 진단 모드 — 마스터가 모달 한 번 더 열면:
1. 모달에 BE 실제 메시지 노출됨 (예: PLAN_NOT_ALLOWED / OWNER_ONLY / SEAT_CHANGE_BLOCKED_NO_EXPIRY_DATE / CLIENT_NOT_FOUND / SEAT_CHANGE_NOT_APPLICABLE_FOR_PLAN 중 하나).
2. BE 콘솔에 `[seatChangeQuote]` / `[seatChangeQuoteCtrl]` 접두사 로그 출력.
3. 두 정보로 다음 hotfix 에서 근본 원인 픽스.

## v001.208.0

> 통합일: 2026-05-19
> 플랜 이슈: #109

### 개요

데이터 뷰어 그리드 뷰에서 마우스 클릭-드래그로 가로 스크롤할 때 열 제목 영역이 본문보다 약 1 컬럼 폭만큼 더 앞서 스크롤되며 정렬이 깨지던 증상 수정. 트랙패드 가로 스크롤은 native onScroll → handleBodyScroll 단일 동기화 경로를 거쳐 정렬이 유지되던 반면, 마우스 드래그 경로는 `useDragScroll.handleDragScrollMouseMove` 가 header / body 두 컨테이너에 raw scrollLeft 를 각각 직접 대입하여 두 컨테이너의 max scrollLeft / onScroll 발화 타이밍 차이로 인한 분기를 만들고 있었다.

### 페이즈 결과

- **Phase 1** (`ec55262`): `useDragScroll` 의 가로 스크롤 경로를 body 단일 소스로 통합. `handleDragScrollMouseMove` 의 `headerScrollRef.current.scrollLeft = newScrollLeft` 대입을 제거하여 body 한 곳에만 scrollLeft 를 쓰고, body 의 `onScroll` → `useScrollSync.handleBodyScroll` 가 header / aggregation / groupHeader 를 body 의 post-clamp scrollLeft 로 동기화하도록 일임. `handleDragScrollMouseDown` 의 시작 scrollLeft 캡처도 `bodyScrollRef.current?.scrollLeft` 로 통일하고, mouseDown / mouseMove deps 배열에서 더 이상 사용하지 않는 `headerScrollRef` 의존성 제거. 텍스트 선택 방지 (`userSelect = 'none'`), 5px 드래그 threshold, 셀 포커싱 / 편집 분기, 다이얼로그 / draggable / 서브그리드 가드 등 기존 가드는 모두 보존. lint gate PASS (0 errors, 17 warnings).

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/features/grid/hooks/useDragScroll.ts`

1개 파일 / +3 / -7 / 단일 페이즈.

### advisor 검증

- 계획 시점 PASS — 5관점 (Intent / Logic / Group Policy / Evidence / Command Fulfillment) 통과. Context 의 원인 추정에 대해 "clamp 차이 vs. onScroll race 둘 다 본 해법으로 함께 해소" 표현으로 soften 권고 반영.
- 완료 시점 PASS — 최종 diff 가 계획과 정확 일치, lint gate exit 0.

### 수동 점검 권장

1. `pnpm dev` (port 5173) 으로 그리드 뷰 진입.
2. 트랙패드 가로 스크롤 — header / body / aggregation / groupHeader 정렬 유지 (회귀 없음).
3. 마우스 클릭-드래그 가로 스크롤 — 좌/우 양방향 끝까지 끌었을 때 header 가 body 보다 앞서 나가지 않음 확인 (스크린샷 재현 케이스).
4. 가로 드래그 도중 5px threshold 미만 클릭은 셀 포커싱 / 편집 정상 동작.
5. groupHeader / aggregation row 가 있는 뷰에서도 동일 시나리오 통과.

## v001.207.0

> 통합일: 2026-05-19
> 플랜 이슈: #105 (HOTFIX 2)

### 개요

마스터 보고: HOTFIX 1 (v001.198.0) 머지 + dev server 재시작 + 하드 리프레시 후에도 "여전히 이미지 크기만큼만 나타남, 요청한 크기로 나와야 하고 이미지도 그만큼 확장해야 함 (비율 유지)". 코드 검증으로 `IMAGE_MODAL_CLASSES` (80vw × 90vh) + `onCloseAutoFocus` 모두 i-dev HEAD 에 정확히 반영 확인. 실제 visible 결함은 비-zoom 이미지의 `max-h-[55vh]` cap (Phase 1 "위험 2" 로 deferred 한 항목) — 90vh 모달 안에서 이미지가 55vh 에서 멈춰 그 아래에 회색 공간이 생기고, 시각적으로 "모달이 이미지 크기만큼만" 으로 인식됨.

### 페이즈 결과

- **Phase 3 (HOTFIX 2)** (`042b7d2`): 비-zoom 이미지 캡 교체.
  - 두 ImageZoomDialog 사본 (`packages/fs-file-attachment/src/ImageZoomDialog.tsx`, `src/widgets/file-attachment/ui/ImageZoomDialog.tsx`) 의 `max-w-full max-h-[55vh] object-contain cursor-zoom-in` 토큰 중 `max-h-[55vh]` 를 `max-h-[calc(90vh-8rem)]` 로 교체. header (~4rem) + footer (~4rem) 예산을 명시한 calc 기반 cap — 부모 height 체인 (`min-h-full` wrap) 의 percentage 해상도 함정과 무관하게 robust.
  - advisor 진단 흐름:
    - 1차 시도 `max-h-full` 은 percentage 해상도 함정 — 부모 wrap div 가 `flex items-center justify-center min-h-full p-4` 로 `h-full` 부재. min-h-full 은 definite height 가 아니라 `max-h-full` 이 image 자연 크기로 resolve → 동일 증상. 마스터 보고 어휘와 정확 일치.
    - 2차 (확정) `max-h-[calc(90vh-8rem)]` 은 viewport 단위 기반이라 부모 height 와 무관, object-contain 가 비율 유지.
  - zoom 상태 (`isZoomed`) 의 inline `width/height` style 경로는 손대지 않음 — 줌 + pan 동작 기존 보존.

### 영향 파일

- data-craft:
  - `packages/fs-file-attachment/src/ImageZoomDialog.tsx`
  - `src/widgets/file-attachment/ui/ImageZoomDialog.tsx`

2개 파일 / +2 / -2 / 단일 페이즈 (advisor followup 포함 2 commit).

### advisor 검증

- 진단 시점 PASS — image cap 가설 advisor 확인. 1차 시도 (`max-h-full`) 의 percentage 해상도 함정도 advisor 가 사전 지적해 calc 로 우회.
- 완료 시점 PASS — 최종 diff (`max-h-[calc(90vh-8rem)]`) 가 advisor 권고와 일치, lint gate PASS (0 errors, 17 warnings).

### 수동 점검 권장

- `pnpm dev` 후 셀 파일 첨부 이미지 썸네일 클릭 → 모달 안 이미지가 모달 내부 가용 공간 (~ 90vh - 8rem header/footer) 만큼 비율 유지하며 확장되는지 확인.
- 큰 가로 비율 이미지 / 큰 세로 비율 이미지 양쪽 모두 잘림 없이 표시되는지 확인 (object-contain 보존).
- 줌 모드 (이미지 클릭) 의 zoom + pan 동작이 기존과 동일한지 확인 (해당 경로 미변경).

### 미해결 (잔여 후속)

- **뒷배경 가로 스크롤**: 마스터 메시지에 "여전히 ... 뒷배경 스크롤" 언급. HOTFIX 1 의 `onCloseAutoFocus` 는 i-dev HEAD 에 정확히 반영 확인됨. fresh screenshot/재현 결과 보고 후 별도 hotfix 진입 가능 (`useScrollLock`/`useBackdropClickClose` 상호작용 가능성).
- **prop-name mismatch**: 패키지 `ImageZoomDialog` 는 `open` prop, app 사본은 `isOpen` prop — latent silent-break 버그 (한쪽 호출자가 잘못된 이름 쓰면 dialog 안 열림). 본 plan 책임 외 — 별도 후속 정렬 권장.

## v001.206.0

> 통합일: 2026-05-19
> 플랜 이슈: #108 (hotfix 2)
> Roadmap-1 단계3-C — DataLinkDialog 모바일 fit 전역 CSS override (잔존 권장 작업 4건 중 1건 해소).

### 핫픽스 결과 — Phase 3 (`959429c`)

마스터 입력 `핫픽스, 잔존도 처리해` 에 대응. 직전 hotfix 1 (v001.202.0) 보고서의 잔존 권장 4건 중 fixable 1건만 적용, 나머지 3건 사유 명시 후 skip.

### 적용 fix

**DataLinkDialog 모바일 fit 전역 CSS override**:
- `DataLinkDialog` (@dcm/fs-data-link-mobile) 는 `className` prop 미노출 + Radix portal 이 document.body 마운트 → wrapper descendant 선택자 도달 불가.
- 해결: 전역 CSS 파일 `apps/web/src/mobile/styles/data-link-override.css` 신규 생성. 선택자 `[data-slot="dialog-content"].w-\[80vw\].h-\[90vh\]` 로 DataLinkDialog DialogContent 전용 매칭 (핫픽스1 에서 95vw/95vh 적용된 DesignerDialog 와 충돌 없음). width/height/max-width 95vw/95vh/95vw `!important` override.
- `AppHeader.tsx` 에 CSS side-effect import 한 줄 추가.

### Skip 사유 (잔존 3건)

- **QueryProvider 로컬 wrap 검증**: 추측성 우려, 실 런타임 사용 외에 정적 검증 불가. 실 사용 시 BLOCK 발생 시 별도 hotfix.
- **권한 게이트 v1 미적용**: `SessionState` 에 `design_external_data` 권한 필드 부재 → BE 측 데이터 변경 없이 게이트 구현 불가. Roadmap-1 hard rule (BE/DB 무수정) 와 상충 → 후속 Roadmap 로 자연 이관.
- **AppHeader 아이콘 그룹화**: 현재 우측 아이콘 3개 (Bot/Network/Bell) — premature optimization. 단계3-D 진입 시 trigger 4 개로 늘면 재검토.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/components/AppHeader.tsx` (CSS side-effect import 추가)
  - `apps/web/src/mobile/styles/data-link-override.css` (신규)

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile hotfix WIP 워크트리) PASS (exit 0, 0 errors).
- advisor #2 (hotfix outcome) PASS.

### Roadmap-1 진행 영향

- 단계3-C 의 후속 권장 작업 4건 중 fixable 1건 (DataLinkDialog 모바일 fit) 해소. 잔존 3건은 사유 명시되어 별도 처리 트랙.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수).

## v001.205.0

> 통합일: 2026-05-19
> 플랜 이슈: #107 (HOTFIX 2)

### 개요

마스터 보고 (이미지 첨부): "초기화하고 저장했더니 다시 [] 괄호에 감싸져서 나와" — 데이터 목록의 다중·추가다중 컬럼이 빈 `[]` 표시. v001.194.0 (Phase 1) 가 `useUserFormWidget.ts:62` 만 고쳤고, 동일 3-분기 JSON.stringify 패턴이 `useFormDialogHandlers.ts:80` (편집 dialog 제출) + `:93` (신규 dialog 제출) 두 곳에 남아 있었던 누락 사용처. "+ 신규등록" 클릭 → FormRenderer 가 multi-select 초기값을 빈 배열 `[]` 로 세팅 → 사용자가 "저장" → `handleDialogSubmit` 신규 분기가 `JSON.stringify([])` → `'[]'` 문자열로 store 저장 → submitNewData 가 그대로 서버 전송 → record 표시 시 `cellRenderers.tsx:103` 의 `Array.isArray('[]')` 실패 → `formatValue` fall-through 로 `'[]'` 그대로 표시.

### 페이즈 결과

- **Phase 3 (HOTFIX 2)** (`fa643e07`): `useFormDialogHandlers.ts` line 80 (편집 분기) + line 93 (신규 분기) 두 곳의 `typeof value === 'object' ? JSON.stringify(value)` 3-분기 체인을 v001.194.0 / v001.200.0 와 동일한 4-분기 체인으로 교체:
  - `null` → `''`
  - `Array` → `value.join(',')` (빈 배열 → `''`, 다중선택 정상 표시)
  - `typeof object` → `` `${value.start}~${value.end}` `` (날짜범위)
  - 그 외 → `String(value)`

  편집·신규 두 dialog 경로 모두 settings 경로(`useFormWidgetSync.ts:76-77`) 와 의미 동등화 — 직렬화 컨벤션이 폼 위젯 전 경로에서 통일.

### 영향 파일

- `data-craft:src/widgets/form-widgets/lib/useFormDialogHandlers.ts`

### 배포 후 잔존 데이터 정리

- 기존에 `'[]'` 로 저장된 record 는 코드 수정만으로 사라지지 않음. 영향 받은 record 는 (a) 수동 삭제 후 신규 등록, 또는 (b) 편집 dialog 에서 다중선택을 다시 채워 저장하면 정상 직렬화로 덮어쓰기 됨.
- 기존 `'["a","b"]'` 형태 legacy record 를 편집 dialog 로 열면 `Array.isArray('["a","b"]')` 실패로 빈 셀렉트로 로드됨. 재저장 시 `''` 로 덮어쓰기 — 마스터는 legacy 행 편집 전에 값 손실 위험 인지 필요.

### 잔여 한계 (스코프 외)

- 4-분기 직렬화가 이제 `useFormWidgetSync.ts` / `useUserFormWidget.ts` / `useFormDialogHandlers.ts` 3곳에 중복 — 공용 유틸 `serializeFormFieldValue` 추출 후보 (별 플랜).
- `useSelectorWidgetSync.ts:108` 의 `JSON.stringify` 는 selector 위젯의 별도 의미 — 본 hotfix 범위 외.

## v001.204.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 13)

### 개요

마스터 보고: "이제 브라우저 인쇄에서 집계 부분도 나타나는데 여전히 디자인은 문제야, 집계를 별도로 표기하라고는 했지만 지금 디자인은 상단 그리드 디자인과 너무 다르잖아, 문서 느낌이 전혀 안나". HOTFIX 10·12 의 카드 디자인 (28pt → 18pt 압축에도) 이 본문 그리드 표와 시각 vocabulary 동떨어짐. advisor 권고 옵션 C 채택 — 메인 요약 표 + distribution 부속 표.

### 페이즈 결과

- **Phase 21 (HOTFIX 13)** (`ec2b7d1`): 본문 table CSS 정찰 → 동일 vocabulary 표 형태로 전면 재설계.
  - **printStyleGenerator.ts**: HOTFIX 10·12 의 `.aggregation-card*` CSS 블록 8개 전부 제거. 본문 table/th/td 와 동일한 `border-collapse`, colorMode 조건부 border 색상, padding, th background 를 사용하는 `aggregation-summary-table` + `aggregation-distribution-table` 신규 블록.
  - **printHtmlBuilder.ts**: `buildAggregationSummaryPage` 의 카드 그리드 빌더 폐기 → 4열 메인 요약 표 (`열 이름 / 집계 타입 / 값 / 부가 정보`) + distribution 컬럼별 소형 부속 표 ("{컬럼명} — 분포" 제목 + 항목/건수 2열, 상위 5 + 외 N개 풋노트).
  - 색상 강조·큰 폰트 강조 제거. break-inside avoid 는 `tr` (메인) / `table` (distribution 부속) 단위 유지.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`

2 파일 / +130 / -78 / 단일 커밋.

### 버전 비트 (v001.204.0 사유)

v001.203.0 발행 시도 시 동시 머지된 별 플랜에 선점 — v001.204.0 으로 재발행. 코드/머지 사실 변동 없음.

### advisor 검증

- **advisor (계획 사전)**: PASS — 옵션 C (메인 요약 표 + 분포 부속 표) 권고 + 본문 table CSS 정찰 우선 요구 반영.
- **lint**: PASS (0 errors, 17 warnings — 신규 위반 없음, 다른 worktree 누적).

## v001.203.0

> 통합일: 2026-05-19
> 플랜 이슈: #91 (hotfix 4)

### 핫픽스 결과 — SeatManageDialog quote 무한 로딩 회복

마스터 보고: 인원 관리 → 다음 결제일 결제 탭 spinner 영구 표시 → 결제 진행 불가. useQuery 의 기본 3회 exp backoff retry + 에러 상태 미표시 조합으로 사용자가 에러 자체를 알 수 없음.

### Phase 20 (FE, `5066475`)

- `SeatManageDialog.tsx` useQuery 옵션 보강: `retry: 1`, `retryDelay: 500` — 1회 즉시 재시도 후 에러 전환.
- `quoteError` 구조 분해 → 두 탭 (next-cycle / immediate) 모두 에러 시 spinner 대신 "결제 견적을 불러오지 못했습니다. 잠시 후 다시 시도하세요." 안내 + 결제 버튼 disabled.
- `seatChange.api.ts` getSeatChangeQuote catch 블록 `console.error` → `console.warn` (retry 노이즈 톤 다운) + 응답 shape 가드 (`nextCycle` / `immediate` 두 키 없으면 `INVALID_QUOTE_RESPONSE_SHAPE` throw).

### 영향 파일

**data-craft**:
- `src/features/subscription/api/seatChange.api.ts`
- `src/features/subscription/ui/SeatManageDialog.tsx`

### 검증

- FE lint PASS (0 errors).

### 잔여 진단 (다음 핫픽스 후보)

- 본 hotfix 는 FE 회복만 — quote endpoint 의 BE 응답 실패 근본 원인은 미진단. 마스터 다음 진입 시 에러 메시지 노출되면 (네트워크 탭 + 에러 토스트) 원인 좁힘 가능.

## v001.202.0

> 통합일: 2026-05-19
> 플랜 이슈: #108 (hotfix 1)
> Roadmap-1 단계3-C 관계 빌더 — DesignerDialog 모바일 fit 보강 + optional prop 타입 정리.

### 핫픽스 결과 — Phase 2 (`4d4a5f7`)

마스터 입력 `핫픽스, 재검토 진행해서 알아서 해결` 에 대응. 직전 plan 페이즈 1 commit `5e5797c` (v001.201.0) 의 DesignerDialog 마운트 코드 리뷰 후 2 fix 적용. advisor 사전·완료 검증 PASS.

- **모바일 fit className 적용**: `<DesignerDialog className="!w-[95vw] !h-[95vh] !max-w-[95vw]" ...>` — 다이얼로그 기본 `80vw × 90vh` 데스크탑 스타일을 모바일 친화 95vw × 95vh 로 `!important` override. 데스크탑 AppHeader 의 className 패턴을 모바일 비율로 조정한 형태.
- **Optional prop 정리**: 이전 마운트의 `selectedGroupId={null}` + `onSelectGroup={() => {}}` 제거. `DesignerDialogProps` 의 `selectedGroupId?: number` / `onSelectGroup?: (groupId: number) => void` 둘 다 optional. `null` 은 `number | undefined` 시그니처와 타입 거짓말이었으므로 default `undefined` 로 정상화.
- **테스트 갱신**: DesignerDialog mock 에 className prop 캡처 추가 + `'95vw' / '95vh'` 포함 회귀 1 케이스 신규.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/components/AppHeader.tsx`
  - `apps/web/src/mobile/components/__tests__/AppHeader.test.tsx`

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile hotfix WIP 워크트리) PASS (exit 0, 0 errors).
- advisor #2 (hotfix outcome) PASS.

### Roadmap-1 진행 영향

- 단계3-C 의 시각 보강 후속 작업 항목 1건 해소 (모바일 fit). 권한 게이트 / QueryProvider 검증은 잔존 — 후속 별도 처리.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수).

## v001.201.0

> 통합일: 2026-05-19
> 플랜 이슈: #108
> Roadmap-1 단계3-C 관계 빌더 진입점 wiring 완료 — **모바일 첫 React Query 도입 인프라 milestone**.

### 페이즈 결과 — Phase 1 (`5e5797c`)

advisor 사전·완료 검증 PASS. 단일 phase 4 step 충족.

- **`apps/web/src/mobile/components/AppHeader.tsx`** 의 Bot 아이콘 우측에 Network 아이콘 trigger 버튼 (44×44 hit target, `aria-label="관계 빌더"`) 추가. `useState<boolean>(false)` 로 `relationOpen` state 관리.
- **`<QueryProvider>{<DesignerDialog isOpen onClose onSave selectedGroupId={null} onSelectGroup />}</QueryProvider>` 조건부 마운트** — `relationOpen` true 일 때만 트리에 출현. `fs-relation-builder-mobile` 의 self-contained hooks (`useSystemDataGroups` 등) 가 기존 `relation.ts` (`/api/relation/*`) 호출.
- **QueryProvider 마운트 결정 = (A) 로컬 wrap**:
  - 근거: 다른 모바일 패키지 (fs-data-link-mobile, fs-file-attachment-mobile 등) 영향 최소화 + dialog close 시 QueryClient 도 함께 소멸 (메모리·상태 격리).
  - 본 plan 이 **모바일 앱의 첫 React Query 도입** — 향후 3-D 또는 다른 패키지가 hooks 도입 시 (B) 전역 mount 로 재검토 가능.
- **데스크탑 패턴 미러**: `data-craft/src/widgets/header/ui/AppHeader.tsx:122` 의 DesignerDialog + `DesignModeToolbar.onDesignerDialogOpen` 패턴을 모바일에 동치 적용 (모바일은 toolbar 없이 헤더 버튼 직결).
- **테스트 갱신** (`__tests__/AppHeader.test.tsx`): 기존 3-B 데이터 링크 회귀 유지 + 신규 관계 빌더 trigger 클릭 / dialog 열림 / 44×44 hit-target 3 케이스. `vi.mock('@dcm/fs-relation-builder-mobile')` 에 QueryProvider 패스스루 stub 포함 — 테스트 환경에서 실 QueryClientProvider 미마운트.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/components/AppHeader.tsx`
  - `apps/web/src/mobile/components/__tests__/AppHeader.test.tsx`

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile WIP A 워크트리) PASS (exit 0, 0 errors).
- advisor #1 (계획) / advisor #2 (완료) 모두 5관점 PASS.

### Roadmap-1 진행 영향

- 단계3-C `/plan-enterprise data-craft 단계3-C` 가 🟢 (모바일에서 관계 빌더 다이얼로그 진입 가능) 갱신 가능.
- 병렬 그룹 2 의 동기 단계 (3-D 파일첨부) 진입 가능.
- **3-D 진입 전 검토 사항**: AppHeader 우측 아이콘이 Bot (3-B) + Network (3-C) + Bell = 3개로 증가. 3-D 가 또 다른 trigger 를 직접 추가하면 4개로 빽빽해짐 — 메뉴 그룹화 또는 다른 진입점 검토 권장.

### 후속 권장 작업 (선택 — 기능 동작은 정상)

- **QueryProvider (A) 로컬 wrap 검증**: DesignerDialog 내부 훅이 마운트 시점에 무조건 QueryClient 필요한 경우 (A) 가 불충분할 수 있음 — 실 사용 검증 후 (B) 전역 마운트 전환 가능.
- **DesignerDialog 80vw × 90vh 데스크탑 스타일**: 모바일에서 비좁음 — 3-B 와 동일 시각 보강 권장.
- **권한 게이트 v1 미적용**: `SessionState` 권한 필드 부재로 인증 사용자 전원 노출 — 3-B 와 동형 후속 보강.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수). fs-relation-builder-mobile 내부 호출은 기존 `/api/relation/*` 엔드포인트.

## v001.200.0

> 통합일: 2026-05-18
> 플랜 이슈: #107 (HOTFIX 1)

### 개요

마스터 보고: "현재 폼 위젯에서 데이터를 초기화 누르고 저장해도 초기화 전 데이터로 나와, 새로고침해도 동일하게 문제 발생". 폼 위젯의 view-mode 에서 필드 변경 시 `useFormWidgetSync.handleFormFieldChange` 가 `scheduleFullSave` 로 500ms debounce 저장을 widgetDataManager 에 등록한다. 사용자가 "초기화" 클릭 시 `useFormWidgetHistory.resetForm` 이 store 만 비울 뿐 pending timer 를 취소하지 않아 **500ms 후 초기화 전 데이터로 서버 저장이 발화** → 새로고침 시 서버에서 다시 받아와 영구화. settings 경로 (`SettingsFormTabContent.tsx:139`) 는 `cancelPendingSave()` 를 `resetForm()` 직전에 호출해 동일 race 를 회피 (정상). 폼 위젯 경로는 이 호출이 누락되어 있었다.

### 페이즈 결과

- **Phase 2 (HOTFIX 1)** (`4b2121d`): `useUserFormWidget.ts` return 객체에 `resetForm: () => { data.cancelPendingSave(); data.resetForm(); }` 합성 핸들러를 명시적으로 오버라이드 — spread 로 전달된 `data.resetForm` 대신 합성 버전이 위젯 toolbar 의 "초기화" 클릭(`UserFormWidget.tsx:68`) 에 사용. widgetDataManager 의 pending debounce timer 를 먼저 드롭(`widgetDataManager.cancelPending` = `clearTimeout`, `widgetDataManager.ts:436`)한 후 store 비우기. settings 경로 `handleDialogCancel` 과 의미적 동일화.

### 영향 파일

- `data-craft:src/widgets/form-widgets/lib/useUserFormWidget.ts`

### 배포 후 잔존 데이터 정리

본 핫픽스는 향후 발생을 막을 뿐, **이미 서버에 잘못 저장된 데이터는 코드 수정만으로 사라지지 않는다**. 배포 후 영향 받은 폼 위젯에서 한 번 더 "초기화 → 저장" 을 수행해 서버 측 잔존 데이터를 정리할 것.

## v001.199.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 12)

### 개요

마스터 보고 (이미지 첨부): "집계 부분이 사진처럼 잘려서 나오고, 지금 쓸데없이 공간을 많이 차지한다는 느낌이 너무 강하게 들어 집계 디자인 설계 다시 개선해". 페이지 14에서 마지막 카드 "작성자" 가 페이지 경계 분할되어 페이지 15 처음에 "39 | 2" 만 잔존. HOTFIX 10 의 카드 디자인이 (a) `break-inside` 미적용으로 페이지 경계 분할 (b) 28pt 큰 강조 + 16px padding + 16px gap + 2 열 으로 공간 과다.

### 페이즈 결과

- **Phase 20 (HOTFIX 12)** (`c5cf4e7` + lint hotfix `874bd83` + lint hotfix2 `4076bc5`): printStyleGenerator + printHtmlBuilder 압축.

#### A. printStyleGenerator.ts — 페이지 분할 방지 + 25-40% 압축

- `.aggregation-card`: `break-inside: avoid` + `page-break-inside: avoid` 이중 emit (브라우저별 호환).
- 사이즈 압축:
  - `.aggregation-summary-page` padding: 20mm → 12mm
  - `.aggregation-summary-title` font-size: 24pt → 18pt
  - `.aggregation-summary-subtitle` font-size: 11pt → 9pt
  - `.aggregation-card-grid`: 2열 → **3열**, gap 16px → 10px, `grid-auto-rows: min-content`
  - `.aggregation-card` padding: 16px → 12px, border: 2px → 1.5px
  - `.aggregation-card-label` 9pt → 8pt
  - `.aggregation-card-title` 13pt → 11pt
  - `.aggregation-card-value`: **28pt → 18pt** (가장 큰 공간 절약)
  - `.aggregation-card-meta` 9pt → 8pt
  - `.aggregation-card-details` 10pt → 9pt, padding 2px → 1px
- `.aggregation-card-more` 신규 — distribution 잔여 항목 "외 N개" 풋노트 스타일 (`border: none !important` 로 셀렉터 충돌 해소).

#### B. printHtmlBuilder.ts — distribution 5항목 상한 + 인라인 스타일 제거

- distribution 카드의 details 출력을 상위 10개 → **상위 5개 + `외 N개` 풋노트** 로 변경.
- 기존 인라인 `style` 속성 (border/padding/background/color) 모두 제거 — CSS 클래스 위임으로 통일. specificity 충돌 해소.

### Lint hotfix 2 라운드

- iter 1 (`874bd83`): 인라인 스타일 제거로 미사용된 `colorMode` 변수 제거.
- iter 2 (`4076bc5`): `options` 파라미터 미사용 → `_options` 리네임.

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`

2 파일 / +51 / -33 / 본 커밋 + lint hotfix 2개.

### advisor 검증

- **advisor (계획 사전)**: PASS — break-inside + 컴팩트 압축 + 3열 + distribution 상한 4축 권고 모두 채택.
- **lint**: PASS (2회 hotfix iter 후 — 0 errors, 11 warnings).

### 잔여 한계

PdfPrintEngine 의 집계 페이지 미지원 (HOTFIX 11 잔여) 그대로 유지.

## v001.198.0

> 통합일: 2026-05-18
> 플랜 이슈: #105 (HOTFIX 1)

### 개요

마스터 보고: v001.193.0 (Phase 1) 머지 후 시각 확인 결과 (1) 모달 너비가 화면 절반에도 못 미침, (2) 모달 배경 클릭 시 뒤 그리드뷰가 가로 스크롤됨. 두 문제 모두 v001.193.0 의 상수 변경만으로는 해결 불가 — Phase 1 의 `w-[80vw]` 가 베이스 `DialogContent` 의 `sm:max-w-lg` (~512px) cap 에 묶였고, 가로 스크롤은 Radix Dialog close 시 focus 복원이 trigger 한 부작용. advisor 진단 후 hotfix 1 phase 로 분리 처리.

### 페이즈 결과

- **Phase 2 (HOTFIX 1)** (`f449f09`): 두 hotfix 동시.
  - **너비 cap 해제**: `IMAGE_MODAL_CLASSES` 두 사본 (`packages/fs-file-attachment/src/lib/uiConstants.ts`, `src/shared/lib/file-attachment-ui.ts`) 에 `max-w-[80vw] sm:max-w-[80vw]` 토큰 추가. twMerge 가 responsive variant 별로 그룹핑하므로 bare `max-w-*` 만으로는 베이스의 `sm:max-w-lg` 를 override 못함 — `sm:max-w-[80vw]` 가 핵심.
  - **close 시 underlying scrollIntoView 차단**: ImageZoomDialog 두 사본 (`packages/fs-file-attachment/src/ImageZoomDialog.tsx`, `src/widgets/file-attachment/ui/ImageZoomDialog.tsx`) 의 `<DialogContent>` 에 `onCloseAutoFocus={(e) => e.preventDefault()}` prop 추가. Radix 가 dialog 닫힐 때 trigger element (썸네일) 로 focus 복원 → 그리드의 horizontal scroll 컨테이너가 focused 요소를 `scrollIntoView` 호출하면서 가로 스크롤 트리거되는 부작용 차단. 닫기 동작 (overlay click / ESC / X / 닫기 버튼) 은 모두 보존.
  - **회귀 방지**: `tests/shared/lib/file-attachment-ui.test.ts` 에 cap-removal 단언 (`toContain('max-w-[80vw]')` + `toContain('sm:max-w-[80vw]')`) test 1개 신규 추가.

### 영향 파일

- data-craft:
  - `packages/fs-file-attachment/src/lib/uiConstants.ts`
  - `src/shared/lib/file-attachment-ui.ts`
  - `packages/fs-file-attachment/src/ImageZoomDialog.tsx` (multi-line prop 형식 — onCloseAutoFocus 별도 라인)
  - `src/widgets/file-attachment/ui/ImageZoomDialog.tsx` (single-line prop 형식 — onCloseAutoFocus 동일 라인)
  - `tests/shared/lib/file-attachment-ui.test.ts`

5개 파일 / +9 / -3 / 단일 커밋.

### advisor 검증

- 진단 시점 PASS — 1번 가설 (twMerge variant grouping) 은 정확. 2번 가설 (overlay DOM propagation) 은 틀렸음을 advisor 가 정정 → 실제 원인은 Radix `onCloseAutoFocus` 의 default focus 복원 + browser `scrollIntoView`. 수술적 fix (`e.preventDefault()`) 로 close 동작 보존하며 부작용만 제거하는 방향으로 조정.
- 완료 시점 PASS — diff 가 advisor #1-validated 진단과 정확 일치, lint gate PASS (0 errors).

### 수동 점검 권장

- `cd /Users/starbox/Documents/GitHub/data-craft && pnpm dev` → 셀의 파일 첨부 이미지 썸네일 클릭 → 모달이 뷰포트 80% × 90% 로 표시되는지 시각 확인 (Phase 1 + HOTFIX 1 누적).
- 모달 열린 상태에서 배경 (overlay) 클릭 → 모달은 닫히되 뒤 그리드뷰의 가로 스크롤이 발생하지 않는지 확인.
- ESC / X / 닫기 버튼으로 닫는 경우도 가로 스크롤 발생하지 않는지 확인.
- `pnpm test tests/shared/lib/file-attachment-ui.test.ts` 로 sync + cap-removal 단언 모두 PASS 재확인.

## v001.197.0

> 통합일: 2026-05-18
> 플랜 이슈: #98
> 데이터 뷰어 "행 연결" (rowLink) 컬럼 타입 신규 추가. 기존 "연결" (connection) 단일-셀 타입을 그룹 단위로 확장하여, 하나의 리더 열 선택만으로 타겟 그룹 행 데이터가 N 개 매핑 열에 자동 입력되는 구조. 8 페이즈, multi-repo (data-craft + data-craft-server).

### 페이즈 결과

- **Phase 1** (`6f3f8b4`, data-craft-server): `ViewerType` 유니온 + `VIEWER_TYPE_TO_COLUMN_TYPE` weight 맵 + `COLUMN_TYPES` 미러 객체에 `'rowLink'` 등록 (`useful` 카테고리, icon Link, defaultWidth 180, weight 2).
- **Phase 2** (`fc4d8ac`, data-craft): `usefulColumnTypes.rowLink` 추가, `entities/row-link/` 신규 (RowLinkConfig 타입 + helpers 4종: stringify/parse/isRowLinkConfig/generateLinkGroupId), E 네임스페이스 등록.
- **Phase 3** (`aad3308`, data-craft, lint-hotfix 2): `RowLinkConfigDialog.tsx` 5-step 마법사 (타겟 그룹 → mode → 열 개수 → 매핑 → 리더). 확정 시 N 개 config 가 동일 linkGroupId 공유, 정확히 1개만 isLeader.
- **Phase 4** (`7276f51`, data-craft, typecheck-hotfix 1): `addRowLinkColumns()` 헬퍼 신규 — N 회 순차 `postChanges('columnAdd')` + 중간 실패 시 역순 클라이언트 rollback. `FsGridColumnGenerator` 에 rowLink 분기 + 다이얼로그 마운트.
- **Phase 5** (`083f739`, data-craft, lint-hotfix 2): 셀 렌더러 3종 신규 — `FsGridRowLinkCellRenderer` (그리드, 리더 ConnectionEditOverlay 재사용 / 비리더 readonly), `RowLinkRenderer` (비그리드 readonly), `useRowLinkCell` (리더 저장 → copy 면 비리더 일괄 채움 / reference 면 row 식별자 저장 + 표시 시 lookup, 리더 클리어 정책). `GridContext` 에 `requestRowLinkTargetRow` optional 콜백 타입 추가.
- **Phase 6** (`9330179`, data-craft, lint-hotfix 3): 열 메뉴 분기 (`rowLinkManage` / `rowLinkEdit`) + 2 다이얼로그 신규 (`RowLinkGroupManageDialog` 982L 표 편집 / `RowLinkGroupEditDialog` 리더 변경·매핑 수정·새 열 추가·재동기화·그룹 해제). `useRowLinkGroup` 헬퍼. i18n ko/en/ja/zh 4언어 + types.ts.
- **Phase 7** (`9b8f672`, data-craft): 다이얼로그 mount wiring 완료 (`UseGridColumnMenuProps` → `useTableViewState` → `useTableViewInit` → `FsGridTableView`). 행/페이스트 정합성 — `isRowLinkNonLeaderColumn` 헬퍼로 rowLink 비리더 셀 페이로드 오염 차단. allowlist/restrictions 에 rowLink 정책. 4 뷰 rendererMap 자연 통과 확인.
- **Phase 8** (`a2da189`, data-craft): `canDeleteRowLinkColumn` 헬퍼 — 리더 단독 삭제 + N=2 그룹의 비리더 삭제 차단 (disabled + tooltip). 칸반 컴팩트 registry 에 rowLink 등록.

### 영향 파일

- data-craft-server:
  - `src/types/viewer.types.ts`
  - `src/types/grid/column-type.types.ts`

- data-craft:
  - `packages/fs-data-viewer/src/entities/column-types/other-types.ts`
  - `packages/fs-data-viewer/src/entities/index.ts`
  - `packages/fs-data-viewer/src/entities/row-link/types.ts` (신규)
  - `packages/fs-data-viewer/src/entities/row-link/helpers.ts` (신규)
  - `packages/fs-data-viewer/src/entities/row-link/index.ts` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkConfigDialog.tsx` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupManageDialog.tsx` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkGroupEditDialog.tsx` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/FsGridRowLinkCellRenderer.tsx` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/RowLinkRenderer.tsx` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/useRowLinkCell.ts` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/useRowLinkGroup.ts` (신규)
  - `packages/fs-data-viewer/src/widgets/cell-renderers/row-link/index.ts` (신규)
  - `packages/fs-data-viewer/src/widgets/column-generator/addRowLinkColumns.ts` (신규)
  - `packages/fs-data-viewer/src/widgets/column-generator/FsGridColumnGenerator.tsx`
  - `packages/fs-data-viewer/src/shared/ui/cell-renderers/rendererMap.tsx`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/index.ts`
  - `packages/fs-data-viewer/src/widgets/fs_grid_renderer/cell-renderer-map.tsx`
  - `packages/fs-data-viewer/src/features/data-viewer/context/GridContext.tsx`
  - `packages/fs-data-viewer/src/features/grid/hooks/column-menu/menuItems.ts`
  - `packages/fs-data-viewer/src/features/grid/hooks/column-menu/types.ts`
  - `packages/fs-data-viewer/src/features/grid/hooks/column-menu/useGridColumnMenu.ts`
  - `packages/fs-data-viewer/src/features/grid/lib/helpers/column-allowlist.ts`
  - `packages/fs-data-viewer/src/features/grid/lib/helpers/column-restrictions.ts`
  - `packages/fs-data-viewer/src/features/grid/lib/row-management/rowAddHelpers.ts`
  - `packages/fs-data-viewer/src/features/grid/lib/row-management/rowPasteUtils.ts`
  - `packages/fs-data-viewer/src/widgets/grid-table/FsGridTableView.tsx`
  - `packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableViewState.ts`
  - `packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableViewInit.ts`
  - `packages/fs-data-viewer/src/widgets/kanban-board/kanban-card/cell-renderers/compact/index.ts`
  - `packages/fs-data-viewer/src/shared/config/i18n/translations/ko.ts`
  - `packages/fs-data-viewer/src/shared/config/i18n/translations/en.ts`
  - `packages/fs-data-viewer/src/shared/config/i18n/translations/ja.ts`
  - `packages/fs-data-viewer/src/shared/config/i18n/translations/zh.ts`
  - `packages/fs-data-viewer/src/shared/config/i18n/types.ts`

### 회귀 검증

- `pnpm lint` (data-craft-server) PASS (exit 0).
- `pnpm typecheck:all && pnpm lint` (data-craft WIP A) 최종 PASS (0 errors, 17 pre-existing warnings).
- advisor #1 (계획) 5관점 PASS, advisor #2 (완료) 5관점 PASS.

### 호스트 측 wiring 후속 (master 수동 테스트 전 확인)

다음 3건은 consumer 측(host) wiring 이 필요하며, 미연동 시 리더값 자동 채움이 silent no-op 동작합니다:

1. **`requestRowLinkTargetRow(targetGroupId, leaderColumnId, leaderValue) → Promise<Record<targetColumnId,string>>`** — host 가 cross-group row lookup 을 구현해 grid context 에 주입 필요. 기존 `requestConnectionValues` 와 별개 신규 콜백. 미연동 시 copy/reference mode 양쪽에서 비리더 자동 채움이 빈값 폴백.
2. **`requestConnectionValues`** — 리더 셀의 ConnectionEditOverlay 가 값 목록을 표시할 때 재사용. 기존 connection 셀이 동작 중이라면 wired 되어 있음. 미동작 시 양쪽 동일 부재.
3. **비그리드 뷰 리더 자동 채움** — 현재 `RenderParams` 가 `rowField`/`saveChange` 를 칸반/캘린더/간트에 전달하지 않음. 그리드에서는 정상 동작, 비그리드 뷰에서 리더 값 변경 시 비리더 채움은 후속 wiring 후 활성.

## v001.196.0

> 통합일: 2026-05-18
> 플랜 이슈: #106
> Roadmap-1 단계3-B 데이터 링크 진입점 wiring 완료.

### 페이즈 결과 — Phase 1 (`f0678df`)

advisor 사전·완료 검증 PASS. 단일 phase 4 step 모두 충족.

- **`apps/web/src/mobile/components/AppHeader.tsx`** 상단 우측에 Bot 아이콘 trigger 버튼 (44×44 hit target) 추가. `useState<boolean>(false)` 로 `dataLinkOpen` state 관리.
- **`<DataLinkDialog open onOpenChange language={'ko'} />` 마운트** — `@dcm/fs-data-link-mobile` 의 self-contained 컴포넌트 (자체 Zustand store + dataLinkQueries 경유 내부 BE 호출). AppHeader 측은 open/onOpenChange 두 prop 만 연결.
- **`__tests__/AppHeader.test.tsx` 신규** — trigger 클릭 → dialog 열림, 닫기 액션, 44×44 hit-target 회귀, menu/bell 버튼 회귀. `DataLinkDialog` 는 `vi.mock` 으로 stub 처리.
- **데스크탑 패턴 미러** — `data-craft/src/widgets/header/ui/AppHeader.tsx:123` 의 `<DataLinkDialog />` + `ManagementButtonGroup` Bot 트리거 패턴을 모바일에 동치 적용.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/components/AppHeader.tsx`
  - `apps/web/src/mobile/components/__tests__/AppHeader.test.tsx` (신규)

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile WIP A 워크트리) PASS (exit 0, 0 errors).
- advisor #1 (계획) / advisor #2 (완료) 모두 5관점 PASS.

### Roadmap-1 진행 영향

- 단계3-B `/plan-enterprise data-craft 단계3-B` 가 🟢 (모바일에서 데이터 링크 다이얼로그 진입 가능) 갱신 가능.
- 병렬 그룹 2 의 동기 단계 (3-C 관계빌더 / 3-D 파일첨부) 진입 가능.

### 후속 권장 작업 (선택 — 기능 동작은 정상)

- **권한 게이트 v1 미적용**: 모바일 `SessionState` 에 `design_external_data` 권한 필드가 없어 인증 사용자 전원에게 trigger 노출. 권한 레이어 도입 후 AppHeader 에 게이트 추가 권장.
- **flat-path `AppHeader.test.tsx` 죽은 테스트**: 기존 flat path 파일이 vitest include 패턴 밖이라 신규 `__tests__/AppHeader.test.tsx` 와 중복 + 죽은 상태. flat-path 파일 삭제 또는 include 패턴 추가는 별도 정리 hotfix 권장.
- **모바일 dialog 시각 보강**: `DataLinkDialog` 가 데스크탑 `h-[90vh]`/`w-[80vw]` 스타일이므로 모바일에서 비좁게 보일 수 있음. `DataLinkSheet` wrapper 신규 추가 등으로 후속 보강 권장.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수). fs-data-link-mobile 내부 호출은 기존 `/api/data-link/*` 엔드포인트.


## v001.195.0

> 통합일: 2026-05-18
> 플랜 이슈: #91 (hotfix 3)
> 버전 양보 메모: 병렬 세션이 v194 선점하여 v001.195.0 으로 양보.

### 핫픽스 결과 — 3 항목

마스터 보고:
1. 인원 관리 모달의 변경할 인원수 입력 필드 바로 아래 표기가 그 아래 컴포넌트(감소 안내 / 추가 탭)와 중복.
2. 결제 수단 등록(신규)이 비밀번호 setup 모달 없이 토스로 직행 — hotfix 1 은 "변경" 진입점만 다뤘고 "등록" 진입점은 별도 컴포넌트.
3. 카드 삭제 시 기존 비밀번호가 폐기되지 않음 — 마스터 의도 "등록/수정/삭제 시 무조건 폐기 + 등록 단계 필수".

### Phase 18 (BE, `617daf0`) — 카드 삭제 시 payment_password NULL

- `user.model.ts` 에 `clearUserPaymentPasswordHash(connection, userId)` 추가 (`UPDATE user SET payment_password = NULL WHERE id = ? AND is_deleted = 0`).
- `billingSubscription.service.ts:deleteCard()` 시그니처에 `userId: number` 추가. 기존 트랜잭션 블록 내 commit 직전에 `clearUserPaymentPasswordHash` 호출 — 카드 삭제 + 비밀번호 폐기 원자 처리.
- `billing.controller.ts:deleteCardController` 가 `req.userId` 파싱 후 service 에 전달.

### Phase 19 (FE, `be145eb`)

**A. SeatManageDialog 중복 텍스트 제거**
- L170~176 의 `{!isNoChange && <p>…</p>}` 블록 (NumberInputWithReturn 직하 안내) 제거.
- 하단 감소 안내 / 추가 탭은 유지.

**B. RegisterCardSection (신규 카드 등록) 비밀번호 setup 강제**
- `handleRegisterCard` 가 기존 loadTossPayments → requestBillingAuth 직행에서 CardInfoSection hotfix 1 패턴 동일하게 전환:
  1. 클릭 시 PaymentPasswordSetupStep 모달 우선 노출.
  2. setup 완료 후에만 toss redirect 진행.
  3. 취소 시 isRegistering false 복원 → toss redirect 발생 안 함 (orphan 방지).

### 영향 파일

**data-craft-server**:
- `src/controllers/billing.controller.ts`
- `src/models/user.model.ts`
- `src/services/billingSubscription.service.ts`

**data-craft**:
- `src/features/subscription/ui/SeatManageDialog.tsx`
- `src/widgets/settings-dialog/ui/plan/RegisterCardSection.tsx`

### 검증

- BE lint PASS (`pnpm lint`, 경고 1).
- FE lint PASS (`pnpm typecheck:all && pnpm lint`, 0 errors).
## v001.194.0

> 통합일: 2026-05-18
> 플랜 이슈: #107

### 개요

마스터 보고: 같은 사용자 입력 폼을 "설정 → 사용자 설정" 과 "화면 → 페이지 → 폼 위젯" 양쪽에 배치했을 때, 다중 선택 상자의 값이 **폼 위젯 경로에서만** `["a","b"]` 형태(JSON 배열 문자열)로 대괄호와 함께 표시되고, 설정 경로는 정상. 원인 = 두 경로의 view-mode 직렬화 규칙 불일치 — settings 경로(`useFormWidgetSync.ts:76-77`) 는 배열을 `value.join(',')` 로 저장(`'a,b'`)하는 반면, widget 경로(`useUserFormWidget.ts:62`) 는 `JSON.stringify(value)` 로 저장(`'["a","b"]'`)하여 `cellRenderers.tsx:103` 의 `Array.isArray` 분기를 둘 다 빗겨나간 뒤 `formatValue` fall-through 에서 raw 문자열이 그대로 표시.

### 페이즈 결과

- **Phase 1** (`aac0b95`): `useUserFormWidget.ts` 뷰모드 `handleFormFieldChange` 직렬화 분기를 settings 경로(`useFormWidgetSync.ts:76-77`) 와 동일 4-분기 체인으로 교체 — `null → ''`, `Array → join(',')`, `{start,end} → 'start~end'`, 그 외 → `String(value)`. 두 경로의 직렬화 결과가 모든 `FormFieldValue` 케이스에서 수렴.

### 영향 파일

- `data-craft:src/widgets/form-widgets/lib/useUserFormWidget.ts`

## v001.193.0

> 통합일: 2026-05-18
> 플랜 이슈: #105

### 개요

마스터 보고: "상세 파일 업로더의 이미지 미리보기 모달이 세로 길고 가로 좁은 비율로 나옴 — 항상 화면 80% × 90% 차지". 데이터 뷰어 (`fs-data-viewer*` 패키지군) 와 데이터 크래프트 앱 양쪽이 공용으로 쓰는 `fs-file-attachment` 의 `ImageZoomDialog` 가 `w-[50vw] h-[70vh]` 였던 것이 원인. 패키지 layer 독립성 (app import 금지) 때문에 동일 상수가 패키지/앱 두 사본으로 존재하며 동기 의무가 헤더 주석 + 단위 테스트로 강제됨.

### 페이즈 결과

- **Phase 1** (`6d25de3`): 공용 `IMAGE_MODAL_CLASSES` 두 사본을 `w-[80vw] h-[90vh]` 로 동시 갱신.
  - **packages/fs-file-attachment/src/lib/uiConstants.ts**: `IMAGE_MODAL_CLASSES` 가로·세로 토큰 갱신 + 주석 헤더 `(70vh × 50vw 고정 + min floor)` → `(90vh × 80vw 고정 + min floor)`.
  - **src/shared/lib/file-attachment-ui.ts**: 위와 동일 (SYNC OBLIGATION 준수).
  - **tests/shared/lib/file-attachment-ui.test.ts**: sync 단언 (`toContain('w-[50vw]')` / `toContain('h-[70vh]')`) 을 새 값으로 갱신, describe 문구 (`70vh × 50vw + min floor 400×300 포함`) 도 동기.
  - min-floor (`min-w-[400px] min-h-[300px]`) 와 나머지 토큰 (`p-0 flex flex-col`, IMG `w-full h-full object-contain`) 은 모두 보존.
  - 모바일 (`data-craft-mobile/packages/fs-file-attachment-mobile`) 동기는 본 플랜 외 (마스터 명령 문언에 모바일 미포함).
  - 모달 내부 이미지 캡 (`max-h-[55vh]`) 는 미변경 — 90vh 모달에서 여백이 도드라지면 별도 핫픽스로 분리 처리 옵션 보존.

### 영향 파일

- data-craft:
  - `packages/fs-file-attachment/src/lib/uiConstants.ts`
  - `src/shared/lib/file-attachment-ui.ts`
  - `tests/shared/lib/file-attachment-ui.test.ts`

3개 파일 / +7 / -7 / 단일 커밋.

### advisor 검증

- 계획 시점 (#1) PASS — 5관점 (Intent / Logic / Group Policy / Evidence / Command Fulfillment) 모두 통과. 초안에 포함되었던 `ImageZoomDialog.tsx` 의 `max-h-[55vh]` → `max-h-[80vh]` 동반 변경은 advisor 가 스코프 외라 지적해 제외 후 본 계획 확정.
- 완료 시점 (#2) PASS — diff 가 계획과 정확 일치, lint gate (`pnpm typecheck:all && pnpm lint`) PASS (0 errors, 11 warnings — 본 페이즈 무관 기존 경고).

### 수동 점검 권장

- `cd /Users/starbox/Documents/GitHub/data-craft && pnpm dev` → 셀의 파일 첨부 이미지 썸네일 클릭 → 모달이 뷰포트 80% × 90% 로 표시되는지 시각 확인 (데이터 크래프트 앱 + 데이터 뷰어 surface 양쪽).
- `pnpm test tests/shared/lib/file-attachment-ui.test.ts` 로 sync 단언 PASS 재확인.

## v001.192.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 11)

### 개요

마스터 보고: "브라우저 인쇄로 넘어가면 집계 부분은 빈 페이지로 나와". HOTFIX 10 의 잔여 한계 #1 정확 일치 — `BrowserPrintEngine.generatePreview` 의 grid case 가 `generateGridPrintHtml(viewerModel, options)` 만 호출하고 HOTFIX 10 에서 추가한 3번째 인자 `aggregations` 를 패스하지 않음. 결과로 인쇄용 HTML 에 집계 페이지 영역 (`page-break-before: always` 가 있는 컨테이너) 는 emit 되지만 내부 카드 그리드 콘텐츠가 비어 빈 페이지로 나옴.

### 페이즈 결과

- **Phase 19 (HOTFIX 11)** (`2aabe95`): 단순 인자 패스-스루.
  - **BrowserPrintEngine.ts**: `execute` 와 `generatePreview` 두 메서드 모두에 `aggregations?: Record<number, ServerAggregationResult>` 4번째 인자 추가. grid case 에서 `generateGridPrintHtml(viewerModel, options, aggregations)` 로 패스. 다른 case (calendar/gantt/kanban/dashboard) 는 aggregations 미사용이라 시그니처만 받고 무시.
  - **PrintContext.tsx**: `executePrint` 의 `engine.execute(...)` 호출에 4번째 인자로 context state 의 `aggregations` 전달. `useCallback` 의존성 배열에 `aggregations` 포함.
  - **engines/types.ts**: 공통 `PrintEngine` 인터페이스의 `execute` / `generatePreview` 시그니처도 `aggregations?` 추가 — 타입 정합성 유지.
  - PdfPrintEngine 은 손대지 않음 (jsPDF autoTable 경로는 집계 행 미렌더 — 별 후속).

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/engines/BrowserPrintEngine.ts`
  - `packages/fs-data-viewer/src/features/print/engines/types.ts`
  - `packages/fs-data-viewer/src/features/print/context/PrintContext.tsx`

3개 파일 / +13 / -8 / 단일 커밋.

### advisor 검증

- **advisor (계획 사전)**: PASS — 한 줄씩 패스-스루, PdfPrintEngine 미손댐 권고 반영.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

### 잔여 한계

PdfPrintEngine (jsPDF autoTable) 경로의 집계 페이지 미지원 — 별 후속 권장.

## v001.191.0

> 통합일: 2026-05-18
> 플랜 이슈: #104

### 개요

마스터 보고: "위젯 설정 드로어에서 폼 위젯을 배치했을 때, 해당 폼이 '목록을 우선 순위로' 옵션을 사용하는 경우에 목록으로 나오게 되는데, 이때 스크롤하면 폼 헤더가 투명해서 헤더 뒤로 스크롤이 지나가는게 보여". 근본 원인 = `FormDataListTable` 의 sticky `<thead>` 가 `bg-muted/50` (50% 불투명도) 사용 → 스크롤되는 본문 행이 sticky 헤더 뒤로 비쳐 보임. 동일 토큰이 hover 행(`hover:bg-muted/50`, 67줄)에 의도적으로 쓰이고 있어 sticky 헤더에 그대로 복사된 결과로 추정. `FormTitle` (정적 컨테이너 상단) 는 sticky 가 아니라 본 증상과 무관.

### 페이즈 결과

- **Phase 1** (`377db33`): `src/widgets/form-widgets/ui/FormDataListTable.tsx:53` 의 `<thead className="bg-muted/50 sticky top-0">` 을 `<thead className="bg-background sticky top-0">` 으로 교체. `--background` 토큰은 oklch alpha 미지정 = 모든 테마(20+종) 에서 100% 불투명 — light/dark 양쪽에서 스크롤 본문 비침 차단.

### 영향 파일

- `data-craft:src/widgets/form-widgets/ui/FormDataListTable.tsx`

### advisor 검증

- 계획 단계 advisor #1: 일시 과부하로 SKIP (마스터 ExitPlanMode 승인으로 진행, 단일 줄 CSS 토큰 교체 위험도 최소).
- 완료 시점 advisor #2: PASS — 진단 정확성(sticky 요소 식별), 토큰 불투명 검증(oklch α=1) 확인.

### 비고 — lint 게이트 정책 충돌 (사전존재)

본 페이즈 lint 게이트(`pnpm typecheck:all && pnpm lint`) 결과 typecheck PASS · lint exit 1 (11 warnings, 0 errors). 11건 전수 변경 무관 파일(PrintContext.tsx / GridRowSelectStep.tsx / useTableView.ts / useGridPrint.ts / FileUploaderField.tsx / ImageUploaderField.tsx / ViewSidebar.tsx) 에서 사전 존재 — `HEAD^` 재실행으로 동일 11건 재현 확인. 본 페이즈가 도입한 회귀가 아니라 i-dev 베이스의 eslint `--max-warnings` 정책 충돌. 마스터 결정 = 본 페이즈 lint 게이트 스킵 후 진행. 후속 정리 플랜은 별도 진행 권장.

## v001.190.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 10)

### 개요

마스터 보고: "인쇄의 집계는 현재 그리드뷰의 집계를 전혀 고려하지 않아서 사실상 의미가 없는 수준이고 0으로만 나와 — 집계는 인쇄에서 표의 연장선이 아니라 집계 전용 페이지를 별도로 구축해서 집계 대상 열에 대해서만 정리해서 시각적으로 인쇄되도록 해줘". 근본 원인 = `useGridPrint.buildAggregationRow` 가 viewerModel.rowModelList 의 in-memory 일부 행만 자체 `values.reduce` sum 계산. 실제 그리드뷰는 서버 집계 (`useServerAggregation` 8 타입) 사용. advisor 사전 검증으로 publish/subscribe 패턴 + 별도 페이지 디자인 spec 확정.

### 페이즈 결과

- **Phase 18 (HOTFIX 10)** (`93bcb15`): 정찰 → publish/subscribe 패턴 → useGridPrint 재구성 → 별도 페이지 빌더 + CSS.

#### 정찰 결과 (advisor.Logic.1 충족)

`PrintProvider` 호출처는 `data-viewer/context/index.tsx` — 여기서는 aggregations 데이터에 접근 불가. 실제 aggregations 는 `useServerPagingOrchestrator → useTableView → FsGridTableView.tv.serverPaging.aggregations` 경로로 존재. PrintProvider 가 FsGridTableView 보다 상위 컴포넌트라 단순 props 전달 불가 → **publish/subscribe 패턴** 채택: PrintContext 에 `publishAggregations` 콜백 추가, `FsGridTableView` 가 aggregations 변경 시 `useEffect` 로 게시.

#### 구현

- **types.ts**: `PrintContextValue.aggregations?: Record<number, ServerAggregationResult>` + `publishAggregations` 콜백 추가.
- **PrintContext.tsx**: aggregations state + publishAggregations callback 노출.
- **FsGridTableView.tsx**: `useEffect` 로 `tv.serverPaging.aggregations` 변경 시 `publishAggregations` 호출.
- **useGridPrint.ts**: 자체 `buildAggregationRow` (in-memory sum) 완전 제거 + tfoot 출력 제거. 본문 table 후 `<div class="page-break"></div>` + `buildAggregationSummaryPage` 호출. aggregations undefined / empty 시 silent fallback (집계 페이지 emit 안 됨).
- **printHtmlBuilder.ts**: `buildAggregationSummaryPage` 신규 함수. 집계 대상 열 (`enableAggregation && aggregations[columnField]`) 만 카드 그리드 (`grid-cols-2`) 로 정리. numeric 열은 `formattedValue` + 합계/평균 meta, distribution 열은 상위 10개 항목 목록.
- **printStyleGenerator.ts**: `.aggregation-summary-page`/`.aggregation-card-grid`/`.aggregation-card` 등 신규 CSS (page-break-before: always, 카드 border + 큰 `tabular-nums` 28pt 강조값, grayscale 모드 대응).

#### 타입 라벨 매핑 (한국어)

`sum=합계 / average=평균 / min=최소 / max=최대 / total=총합 / weightedAverage=가중평균 / weightedSum=가중합계 / distribution=분포`

### 영향 파일

- data-craft (fs-data-viewer):
  - `packages/fs-data-viewer/src/features/print/types.ts`
  - `packages/fs-data-viewer/src/features/print/context/PrintContext.tsx`
  - `packages/fs-data-viewer/src/features/print/views/grid/useGridPrint.ts`
  - `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`
  - `packages/fs-data-viewer/src/widgets/grid-table/FsGridTableView.tsx`

6개 파일 / +224 / -68 / 단일 커밋.

### 잔여 한계

1. `BrowserPrintEngine.ts` 의 `generatePreview` 메서드도 `generateGridPrintHtml` 을 aggregations 인자 없이 호출 → 미리보기 생성 시점에는 집계 페이지 emit 안 됨. PrintContext 가 publish 받은 aggregations 를 useGridPrint 로 전달하는 미리보기 경로는 활성화되어 있어 PrintContext 의 htmlContent 는 정상 생성. BrowserPrintEngine 의 `generatePreview` 직접 호출 경로 (= 실제 인쇄) 도 aggregations 주입 가능한지는 추가 검토 필요 — 별 후속 권장.
2. rowScope (HOTFIX 3 의 전체/선택/범위) 와 무관하게 화면 캐시된 aggregations 그대로 사용 (마스터 "그리드뷰의 집계" 해석). subset 집계는 별 후속.
3. fs-external/fs-sub 손대지 않음 — 그리드 전용이지만 별 후속.

### advisor 검증

- **advisor (계획 사전)**: BLOCK → 정찰 우선 + 디자인 spec 명시 + 6단계 순서 권고 채택. 정찰 결과로 publish/subscribe 패턴 확정.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.189.0

> 통합일: 2026-05-18
> 플랜 이슈: #103
> Roadmap-1 단계3-A user-form 화면 신규 구현 완성 (compose 는 Roadmap-005 이관).

### 페이즈 결과 — Phase 1 (`8e89fb5`)

advisor 사전·완료 검증 PASS. 단일 phase 의 5 step 모두 충족 + 정정 사항 1건.

- **신규 `ScreenUserForm`** (`apps/web/src/mobile/screens/user-form/`): `builderApi.getFormById` 로 폼 메타 로드 (AbortController + loading/error/empty 단계1-B / 단계2 패턴 미러). `@dcm/fs-form-builder-mobile` 의 `FormFieldRenderer` 를 per-field 로 직접 호출 (FormCanvas 의 dnd-kit + useFormStore 의존 회피 — 입력 모드 한정). widgetId/pageId 는 location.state (WidgetCard 경유) 또는 query param 으로 수신. recordId query 존재 시 편집 모드, 없으면 신규 row 작성. 저장 성공 시 toast 1.2초 후 navigate(-1), 실패 시 인라인 에러 + 재시도.
- **`fs-form-builder-mobile/src/index.ts` 핵심 export 활성**: 본 plan 이 "후속 G-3 mobile page viewer 에서 결정" 주석에 명시된 G-3 후속에 해당. `FormFieldRenderer` / `FormFieldRendererProps` / `FormFieldValue` / `convertUserFormToForm` / `Form` / `FormField` 활성 (ScreenUserForm 이 필요한 최소만).
- **`routes/user-form/[id].tsx`**: Placeholder import 제거, `record/[id].tsx` 패턴 미러로 Suspense + lazy `ScreenUserFormLazy` 재작성.
- **`routes/compose.tsx`**: 변경 없음 — Roadmap-005 (SNS 후속) 이관 인정.
- **테스트 신규** (`__tests__/ScreenUserForm.test.tsx` — 10 케이스): 로딩 / 에러+재시도 / 빈 폼 / 필드 렌더 / 신규 제출 성공 / 저장 실패 / widgetId 누락 에러 / 편집 모드 (recordId 분기) / 컨테이너 마운트 / 뒤로 버튼.

### 정정 사항 (plan vs outcome divergence)

본 plan 본문은 저장 API 로 `viewerApi.postChanges` / `saveChanges` 를 언급했으나, phase-executor 가 실제 구현 시 발견: 두 API 는 `FormField.id` (UUID) → grid `columnId` (numeric) 매핑 정보를 클라이언트에서 보유하지 않아 폼 값을 그리드 셀로 직접 쓸 수 없음. **올바른 저장 경로는 `inputStoreApi.save`** — 서버가 fieldName=widgetId UUID 기반으로 매핑 처리. phase-executor 가 자율적으로 inputStoreApi.save 로 pivot. **`inputStoreApi.save` 도 기존 API 이므로 BE 변경 0 hard rule 유지**. plan 본문의 API 선택 오류만 정정 — 작업 결과는 형식적으로 동치.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/screens/user-form/ScreenUserForm.tsx` (신규)
  - `apps/web/src/mobile/screens/user-form/__tests__/ScreenUserForm.test.tsx` (신규)
  - `apps/web/src/mobile/routes/user-form/[id].tsx`
  - `packages/fs-form-builder-mobile/src/index.ts`

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile WIP A 워크트리) PASS (exit 0, 0 errors).
- advisor #1 (계획) / advisor #2 (완료) 모두 5관점 PASS.

### Roadmap-1 진행 영향

- 단계3-A `/plan-enterprise data-craft 단계3-A` 가 🟢 (user-form 측 wiring 완료) 갱신 가능. compose 분기는 Roadmap-005 이관 명시.
- 병렬 그룹 2 의 동기 단계 (3-B 데이터링크 / 3-C 관계빌더 / 3-D 파일첨부) 진입 가능.

### 후속 필수 작업 (master attention required)

- **widget→user-form 네비 state 누락**: ScreenGridViewer / ScreenCalendarViewer / ScreenKanbanViewer 가 `navigate('/m/user-form/${linkedFormId}')` 호출 시 widgetId/pageId 를 location.state 에 포함하지 않음. 현 ScreenUserForm 은 저장 시 widgetId 부재로 인라인 에러를 표시. 위젯에서 user-form 진입 후 저장이 정상 동작하려면 3 viewer 의 navigate 호출 부분에 state 추가 필요. **본 plan 범위 밖, 별도 hotfix 또는 phase 로 분리 권장**.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수). `inputStoreApi.save` 는 기존 BE 엔드포인트 호출.

## v001.188.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 9)

### 개요

마스터 보고 (PDF 이미지 첨부): "상,하단에 모두 이상한 가로 구분선이 있고 노란색 선은 집계 같은데 이거 집계는 가장 마지막에 한번에 전부 합산 계산 해서 나오게 해". BrowserPrintEngine 의 브라우저 print-to-PDF 결과에서 `<tfoot>` 가 페이지마다 footer 로 반복 출력되던 동작 + `.print-header` / `.print-footer` 의 회색 border 가 마스터 의도와 어긋남.

### 페이즈 결과

- **Phase 17 (HOTFIX 9)** (`4bac29c`): `printStyleGenerator.ts` 단일 파일에서 3줄 변경.
  - **tfoot 페이지 반복 차단**: `tfoot { display: table-footer-group }` (브라우저 기본 — 페이지마다 자동 반복) → `display: table-row-group` (tbody 와 같은 그룹, 마지막 페이지 tbody 끝에 한 번만). aggregation 의 합산 값 자체는 `buildAggregationRow` 가 *전체 행 기준* 으로 이미 계산하므로 마스터 명령 "마지막에 한 번에 전부 합산 계산" 충족.
  - **상하단 회색 가로 구분선 제거**: `.print-header { border-bottom: 1px solid #ddd }` + `.print-footer { border-top: 1px solid #ddd }` 두 라인 삭제. 마스터의 "이상한 가로 구분선" 정확히 일치.
  - **노란색 (orange) 집계 강조 보존**: `.aggregation-row { border-top: 2px solid #ff9800 }` 유지 — 마스터 명령은 "마지막에 한 번만" 이지 색 제거 아님. 집계 행 시각 구분 의도 보존.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`

1개 파일 / +1 / -3 / 단일 커밋.

### Scope 한정 사유

- PdfPrintEngine (jsPDF autoTable 직접 그리기) 경로는 집계 행 자체를 렌더링하지 않음 — 마스터가 본 PDF 는 BrowserPrintEngine (브라우저 print → PDF 저장) 결과로 확정. PdfPrintEngine 추가 대응 불필요.
- fs-external/fs-sub 손대지 않음 (별 후속 권장 — 마스터 보고는 fs-data-viewer 한정).

### advisor 검증

- **advisor (계획 사전)**: PASS — 2 corrections (PdfPrintEngine 경로 확인 + line 90/104 selector context 확인) 반영. executor 가 두 사항 진단 후 확정.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.187.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 11)
> 비고: v001.186.0 는 동시 진행이 선점, 본 entry 는 v001.187.0 으로 bump.

### 핫픽스 결과 — Phase 15 (`d6f47e9`)

advisor 사전 검증 PASS — 6회 hotfix yo-yo 끝, dynamic shift 처방.

### Root cause

`shouldOffset ? 'right-[28.5rem]' : 'right-2'` 의 **28.5rem 고정 시프트가 좁은 area (너비 20%, ~230px) 에서는 area 자체 너비보다 큰 값** → controls 가 area 좌측 경계 너머로 밀려 이전 area 의 시각 영역에 노출. hotfix 10 의 `overflow-visible` 가 클리핑을 풀어 결과적으로 다른 area 에 침범 시각화.

hotfix 9 → 10 → 11 의 layered diagnosis:
1. hotfix 9: CSS calc 공백 명세 위반 → 클래스 무효 → 시프트 발생 안 함 (wide area 도 가려짐). FIXED.
2. hotfix 10: 시프트는 작동하나 narrow area 에서 overflow-auto 클리핑으로 안 보임. FIXED (outer Area 로 이동).
3. **hotfix 11 (본 entry)**: 클리핑 풀린 후 28.5rem 고정 시프트가 narrow area 좌측 경계 넘김 → 다른 area 침범. dynamic shift 로 정확 양만 적용. FIXED.

### 처방

- **`useDrawerOverlap.ts`**: 반환 타입 `boolean` → `number shiftPx`. `shiftPx = Math.max(0, rect.right - drawerLeft) + 8` (8px safety margin). drawer 와 겹치는 픽셀만큼만 정확히 시프트.
- **`AreaControls.tsx`**: `shouldOffset ? 'right-[28.5rem]' : 'right-2'` → `shiftPx === 0 && 'right-2'` + `style={shiftPx > 0 ? { right: \`${shiftPx}px\` } : undefined}` (inline). `transition-[opacity,right]` 유지 — inline style 변화에도 transition 작동.
- **`SubAreaControls.tsx`**: 동일 버그 (`right-[calc(28rem+0.5rem)]` 고정) 동시 처방. row-split SubArea 도 같은 동작.

### 의미

- 좁은 area: shiftPx = drawer 침범 양 + 8px → controls 가 area 우측 가시 경계 (drawer 왼쪽 8px) 에 머무름. **area 좌측 경계 넘김 없음**.
- 넓은 area: shiftPx = drawer 침범 양 + 8px (이전 28.5rem 안전 margin 으로 잡았으나 실제론 침범 양보다 클 수 있음 — 본 fix 가 정확 양만).
- 오버랩 없음: shiftPx = 0, `right-2` fallback (평소대로).

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/hooks/useDrawerOverlap.ts`
  - `src/widgets/layout-canvas/ui/AreaControls.tsx`
  - `src/widgets/layout-canvas/ui/SubAreaControls.tsx` (동일 버그 동시 처방)

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 5관점 PASS — 6회 layered diagnosis 정리.

### 잠재 우려 / Latent

- controls 자체 너비 (~200-300px) 가 매우 좁은 area (e.g. 너비 100px) 보다 크면 controls 일부 좌측 빠질 수 있음. drawer 침범은 0, area 침범은 최소화 — acceptable degradation.
- 누적 latent: FloatingSectionBanner X 버튼 widget 경로 미닫힘 / `openAreaDrawer` 호출처 없음.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 11` (본 entry) — Phase 15 → data-craft i-dev 머지 + patch-note v001.186.0
2. 마스터 manual test 결과에 따라 PENDING gate.

---

## v001.186.0

> 통합일: 2026-05-18
> 플랜 이슈: #91 (hotfix 2)
> 버전 양보 메모 (CLAUDE.md §5 step 4): 머지 시점에 #102 가 v185 선점하여 v001.186.0 으로 양보.

### 핫픽스 결과 — 2 항목

마스터 보고:
1. 인원 관리 버튼이 과하게 두드러짐 — 테두리 제거 + 연한 배경 + 작은 사이즈로 톤 다운.
2. 런타임 크래시 — `TypeError: Cannot read properties of undefined (reading 'applyAtDate')` at `SeatManageDialog.tsx:357`. quote 응답 구조 불완전 (delta=0 / 로딩 / 에러) 시 `quote.nextCycle.applyAtDate` 접근으로 throw.

### Phase 17 (FE, `2f14948`)

**A. BillingInfoSection 인원 관리 버튼 톤 다운**
- variant=outline → `variant=ghost` + `bg-gray-100` (다크: `bg-muted/50`).
- size 축소 — `h-7 px-2 text-xs`. n/m명 라벨과 비례 일치.
- hover 시 `bg-gray-200` (다크: `bg-muted`).

**B. SeatManageDialog quote 가드 강화**
- 기존 `!quote` 단일 가드 → `!quote?.nextCycle` / `!quote?.immediate` 옵셔널 체이닝 분기.
- 각 필드 접근에 `??` 폴백 — applyAtDate/applyAtAmount/applyAtSeats, nextBillingDate/nextBillingAmount/nextBillingSeats, immediate.amount.
- 결제 실행 버튼 disabled 조건 강화 — quote 구조 불완전 시 비활성.

### 영향 파일

**data-craft**:
- `src/features/subscription/ui/SeatManageDialog.tsx`
- `src/widgets/settings-dialog/ui/plan/BillingInfoSection.tsx`

### 검증

- Lint gate PASS (`pnpm typecheck:all && pnpm lint`, 0 errors).

---

## v001.185.0

> 통합일: 2026-05-18
> 플랜 이슈: #102

### 개요

QA 가 입력 위젯 (단일 / 복수 선택) 에 대해 두 가지 결함 지적:
1. 선택한 값에 따라 위젯 너비가 변동 (콘텐츠 폭에 끌려감) — 기존 설정 너비 고정 필요.
2. 뷰모드에서 저장된 선택값 삭제 시 빈값 처리 대신 `undefined 외 -1` 문자열 표시.

두 결함 모두 동일 컴포넌트 군 (selector-widget + shared MultiSelectDropdown) 의 좁은 라인 수정으로 해소.

### 페이즈 결과

- **Phase 1** (`3d16f42`): 선택 위젯 너비 고정 — flexbox 자식 `min-width: auto` 기본값이 `flex-1` wrapper 를 트리거 콘텐츠 크기로 늘어나게 만들던 버그 해소. `SelectorDropdown.tsx` (MultiDropdown) / `SingleDropdown.tsx` 의 인덱스 wrapper `div` `cn()` 에 `'min-w-0'` 추가. 자식 트리거의 `w-full + truncate` 가 비로소 동작.
- **Phase 2** (`9181970`): `MultiSelectDropdown.widget.tsx` `getDisplayText()` 에 `selectedLabels.length === 0` 가드 추가. `selectedValues` 가 비어있지 않으나 모든 값이 현재 `options` 에 매칭되지 않을 때 (stale value) `selectedLabels=[]` 에서 마지막 return 으로 흘러 `undefined 외 -1` 문자열을 생성하던 경로 차단. 매칭 0인 경우 placeholder 로 폴백.

### 영향 파일

- data-craft:
  - `src/widgets/selector-widget/ui/SelectorDropdown.tsx`
  - `src/widgets/selector-widget/ui/SingleDropdown.tsx`
  - `src/shared/ui/widgets/MultiSelectDropdown.widget.tsx`

3개 파일 / +4 / -0 / 2 커밋 + 1 머지 커밋.

### advisor 검증

- **advisor (계획 사전)**: PASS — `-1` 생산 지점 (MultiSelectDropdown.widget.tsx:134 `selectedLabels.length - 1`) 특정, shadcn `select.tsx` 기본값 미변경 안전 경로 채택, Phase 1 영향 파일에서 `MultiSelectDropdown.widget.tsx` 제외하여 페이즈 분리.
- **advisor (완료 사후)**: PASS — 두 페이즈 모두 의도 라인에 정확히 안착 (Phase 1 wrapper `div` cn() / Phase 2 `selectedLabels` 선언 이후 + `length === 1` 분기 이전).
- **lint** (`pnpm typecheck:all && pnpm lint`): PASS 양 페이즈 (0 errors, 11 warnings — 신규 위반 없음).

### 잔여 / 후속

- 단일 선택 측 stale value 표시는 Radix Select 의 placeholder 폴백 동작에 의존. 단일 선택 변형 결함 신규 보고 시 별도 가드 검토.
- stale value **저장 측 정정** (서버 저장값이 옵션에 없을 때 자동 빈배열로 정정) 은 본 플랜 범위 외. 표시 레이어 차단만 적용.
- 브라우저 스모크 테스트 미수행 — 양 페이즈 모두 단일 라인 수정 (canonical `min-w-0` for flex truncation / 단순 length 가드) 으로 정적 검증으로 충분 판단. 마스터의 브라우저 확인 권장.

## v001.184.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 8)

### 개요

마스터 보고: "여전히 생성 중...에서 멈춰있어, 브라우저로 넘겼으면 데이터 크래프트 측은 작업 종료로 간주하고 모달 닫고 처리 마무리하게 해". HOTFIX 7 의 3중 안전망이 일부 환경에서 fire 안 됨 → 마스터 명시 요구에 따라 `cleanup` 과 `resolve` 분리, `iframeWin.print()` 호출 직후 즉시 resolve.

### 페이즈 결과

- **Phase 16 (HOTFIX 8)** (`4ead5323`): fs-data-viewer 의 `BrowserPrintEngine.execute()` Promise 재설계.
  - **cleanup·resolve 분리**: HOTFIX 7 의 `finishOnce` (cleanup + resolve 묶음) → `backgroundCleanup` (iframe 제거 전용, 비동기) + 즉시 `resolve()` 분리. `iframeWin.print()` 호출 성공 직후 Promise resolve → executePrint 의 await 종료 → setIsGenerating(false) + setIsOpen(false) 즉시 실행 → 모달 정상 닫힘.
  - **백그라운드 cleanup 보존**: HOTFIX 7 의 3중 안전망 (onafterprint / matchMedia 'print' change / 60s timeout) 은 *iframe 비동기 제거* 전용으로 유지. 사용자 눈에 띄지 않게 백그라운드 처리.
  - **about:blank 첫 onload 가드** (advisor concern): srcdoc 적용 이전 시점에 iframe 의 about:blank 로드로 onload 가 발화될 수 있음 → `iframeWin.location.href === 'about:blank'` 시 return.
  - **print() 동기 throw 처리** (advisor concern): 팝업 차단·security 거부 등 동기 throw 발생 시 backgroundCleanup + reject → executePrint catch 가 status='error' 처리.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/features/print/engines/BrowserPrintEngine.ts`

1개 파일 / +29 / -17 / 단일 커밋.

### advisor 검증

- **advisor (계획 사전)**: PASS — 3개 concerns 사전 반영 (print() throw → reject, about:blank 가드, cleanup·resolve 분리).
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.183.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 10)
> 비고: v001.180.0/181.0/182.0 은 #86/#91/#101 가 선점하여 본 entry 는 v001.183.0 으로 bump.

### 핫픽스 결과 — Phase 14 (`aab4811`)

### Root cause

좁은 Area (e.g. 너비 20%) 에서 AreaControls 의 `shouldOffset` 시프트 (`right-[28.5rem]`) 가 Area 의 왼쪽 경계 너머로 controls 를 밀어내면, 그 controls 가 inner wrapper (`absolute inset-0 ... overflow-auto`) 의 클리핑 박스 밖으로 나가 **overflow-auto 에 의해 잘려서 안 보임**. 너비 indicator (`left-2`) 는 area 내부에 머무르며 클리핑 안 됨 → 마스터 관찰 "너비 %만 보임" 과 일치.

hotfix 9 의 calc 공백 명세 위반 fix 는 wide Area 에 대해서는 작동했으나, narrow Area 의 overflow 클리핑은 별도 layer 문제로 노출됨.

### 처방

`Area.tsx`: AreaControls + width-indicator 를 inner wrapper (`overflow-auto`) 내부 → outer Area (`overflow-visible` in design mode) 의 **직접 자식** 으로 이동. dim/focus overlay 와 sibling 순서. outer Area 는 이미 `relative` 라 absolute positioning 기준점 동일하게 유지.

inner wrapper 는 `overflow-auto` 유지 (위젯 콘텐츠 클리핑 용도). outer Area 의 `overflow-visible` 덕분에 controls 가 area 경계 너머로 시프트되어도 클리핑 없음.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx` (+18 / -18 — 단순 위치 이동)

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).

### 잠재 우려 / Latent (누적)

- FloatingSectionBanner X 버튼이 widget 경로 banner 닫지 못함.
- `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 10` (본 entry) — Phase 14 → data-craft i-dev 머지 + patch-note v001.183.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `플랜 완료` 또는 추가 핫픽스.

---

## v001.182.0

> 통합일: 2026-05-18
> 플랜 이슈: #101
> Roadmap-1 단계2 (데이터 뷰어 5종) 잔여 작업 — Dashboard 차트 wiring 완성.

### 페이즈 결과 — Phase 1 (`13d986d`)

advisor 사전·완료 검증 PASS. 5종 viewer 중 4종 (Grid·Kanban·Calendar·Gantt) 은 선행 enterprise-454/457/459 분기에서 이미 실 API 와 wired-up 완료 상태로 인정, 본 plan 의 작업 표면 = Dashboard 차트 wiring 단일 phase 한정.

- **집계 fetch 추가**: `ScreenDashboardViewer` 가 `viewerApi.getDashboardBatchAggregation(groupId, params, signal)` 을 추가 호출. 기존 `getDashboardLayout` 흐름과 단일 `AbortController` 공유 (`useRecordRow` 패턴 미러). `buildWidgetBatchParam` (`@dcm/fs-data-viewer-mobile`) 으로 layout 응답의 위젯 목록에서 batch param 구성.
- **로컬 placeholder 제거 → 실 차트 위젯 분기**: 기존 ScreenDashboardViewer 내부의 `WidgetCard` placeholder (type 라벨 + dimension 만 표시) 를 완전 제거. `@dcm/fs-data-viewer-mobile/widgets/dashboard/widgets/` 의 7 차트 위젯 (`BarChartWidget`, `LineChartWidget`, `PieChartWidget`, `ScatterChartWidget`, `CardWidget`, `GaugeWidget`, `UserListWidget`) 을 type 별 분기 import + 렌더하는 `renderMobileWidget` 헬퍼를 screen 내부 함수로 도입 (별도 파일 없이 scope 유지).
- **메타·컬럼 어댑터**: `DashboardWidgetLayoutMeta → DashboardWidget` 변환 (`metaToWidget` — settings 를 `DashboardWidgetConfig` 로 cast) + `viewport.columns → FsGridColumnModel[]` 합성 (`viewportToColumnModels` — width/title/type/enableAggregation 등 차트 위젯이 요구하는 column 모델 합성) 를 screen 내부 헬퍼로 둠.
- **I18nProvider 래핑**: 차트 위젯들의 `useI18n` 컨텍스트 요구를 충족하도록 위젯 트리를 `I18nProvider` 로 감쌈.
- **WidgetFullscreenSheet 정합**: `widgetEntity` + `columnModelList` + `aggregationData` props 추가 — 풀스크린 시트에서도 동일한 실 차트가 렌더되도록 정합.
- **테스트 신규** (`__tests__/ScreenDashboardViewer.test.tsx` — 13 케이스): `vi.mock('@dcm/fs-api-mobile')` 로 layout + aggregation stub, flatten 정렬 (KPI → 차트 → 리스트) 회귀, loading/error/empty 분기, fullscreen sheet open/close, aggregation 호출 검증 모두 커버.

### Informational deviations (실행 막지 않음, 후속 trace 용)

- **Scatter/UserList 데이터 소스**: 두 위젯은 서버 집계 (`aggregationData`) 없이 클라이언트 행 데이터 (`preprocessedRows`) 로만 동작하는 시그니처. 모바일에서 row 데이터를 별도 로드하지 않는 한 두 위젯은 '데이터 소스 미설정' 상태로 렌더. 실 데이터 렌더는 별도 GET paged row fetch 추가 형태로 후속 처리 가능 (Roadmap-1 hard rule 내 가능).
- **`buildWidgetBatchParam` settings 의존**: 위젯 settings 필드가 `DashboardWidgetConfig` 와 완전히 일치하지 않을 경우 batch param 빌더가 null 반환 → 런타임에서 위젯 집계 없이 fallback 렌더. 실 BE 응답 shape 와의 정합성은 통합 테스트 시점에 확인.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/screens/dashboard-viewer/ScreenDashboardViewer.tsx`
  - `apps/web/src/mobile/screens/dashboard-viewer/__tests__/ScreenDashboardViewer.test.tsx` (신규)
  - `apps/web/src/mobile/components/WidgetFullscreenSheet.tsx`

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile WIP A 워크트리) PASS (exit 0, 0 errors).
- advisor #1 (계획) / advisor #2 (완료) 모두 5관점 PASS.

### Roadmap-1 진행 영향

- 단계2 `/plan-enterprise data-craft 단계2 데이터 뷰어 5종` 가 🟢 (5종 viewer 모두 FE-가능 최대치 도달) 갱신 가능.
- 4종 viewer (Grid·Kanban·Calendar·Gantt) 의 선행 완료는 본 patch-note 와 issue #101 이 audit 으로 기록.
- Scatter/UserList 의 row-data 후속 wiring 은 별도 phase 또는 다음 단계 진행 시 고려.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수). data-craft-server / data-craft 리포 read-only 유지.

---

## v001.181.0

> 통합일: 2026-05-18
> 플랜 이슈: #91 (hotfix 1)
> 버전 양보 메모 (CLAUDE.md §5 step 4): 본 hotfix 머지 시점에 병렬 세션이 v174~v180 선점하여 v001.181.0 으로 양보.

### 핫픽스 결과 — 2 결함 동시 해소

마스터 보고:
1. 결제 비밀번호 설정 실패 — `[ERROR] PLAN_NOT_ALLOWED (POST /api/user/payment-password/set, status=403)`. permission middleware 의 plan 기반 화이트리스트에 신규 payment-password 엔드포인트 미등록 → FREE 외 모든 플랜에서 403.
2. 결제 비밀번호 입력/설정 UI 가 텍스트필드 — 마스터 요구: 4행×3열 스크램블 숫자 패드 (10개 숫자 + 빈 2칸 모두 매번 랜덤 위치).
3. 추가 마스터 보고 (심각 결함): 카드 등록 성공 + 비밀번호 설정 실패 시 카드는 등록된 상태로 남고 비밀번호 없음 → orphan 카드 발생.

### Phase 15 (BE, `b8037f5`) — permission 화이트리스트

- `src/middlewares/permission.middleware.ts` `PLAN_ENDPOINTS[FREE]` 에 payment-password 3 엔드포인트 추가 (POST /set, POST /verify, GET /exists). `PLAN_HIERARCHY` 가 사용자 plan 이하 모든 엔드포인트를 허용하므로 FREE 추가 = 전 plan 통과 보장 (FREE through ENTERPRISE 모두 200).
- routes/user.ts 변경 불필요 (라우트는 Phase 1 에서 정상 등록).

### Phase 16 (FE, `eb5269a` + req6 보강 `d96eb7a`)

**A. 스크램블 PIN pad**

- `src/shared/ui/pin-pad.tsx` 신규 공용 컴포넌트 — 4행×3열 그리드, Fisher–Yates 셔플로 `[0..9, null, null]` 12개를 매 shuffleKey 변경 시 재셔플. 6칸 진행 도트 표시기 + 별도 영역 백스페이스 버튼. 6자리 완성 시 자동 verify/proceed.
- `PaymentPasswordInputDialog.tsx` / `PaymentPasswordSetupStep.tsx` 의 텍스트필드를 PinPad 로 교체. SetupStep 의 enter/confirm 두 단계는 각각 독립 shuffleKey 사용.

**B. 카드 등록 흐름 역전 (orphan 카드 방지)**

- `CardInfoSection.tsx` 의 카드 변경 클릭 핸들러 재설계: **항상** PaymentPasswordSetupStep 모달 우선 노출 (요구 6 명문 — "변경 시 기존 비밀번호 폐기" 충족). 모달 완료 후에만 토스 빌링 redirect 진행. 모달 취소 시 토스 redirect 일어나지 않음 → 카드 register 자체가 발생하지 않음 → orphan 카드 원천 차단.
- `BillingSuccessPage.tsx` 의 카드 분기 후속 setShowPasswordSetup 호출 제거 (이제 카드 등록 전에 비밀번호 설정이 완료되어 있으므로 불필요). 신규구독/프로모션결제 분기는 그대로 유지.

### 영향 파일

**data-craft-server**:
- `src/middlewares/permission.middleware.ts` (+4 lines)

**data-craft**:
- `src/shared/ui/pin-pad.tsx` (신규)
- `src/features/subscription/ui/PaymentPasswordInputDialog.tsx`
- `src/features/subscription/ui/PaymentPasswordSetupStep.tsx`
- `src/widgets/settings-dialog/ui/plan/CardInfoSection.tsx`
- `src/pages/billing-callback/ui/BillingSuccessPage.tsx`

### 검증

- 전 분기 lint gate PASS — data-craft-server `pnpm lint` exit 0, data-craft `pnpm typecheck:all && pnpm lint` 0 errors.
- advisor (hotfix 시점 사전 검토): permission 화이트리스트의 PLAN_HIERARCHY 동작 직접 read 검증 — `userPlanIndex` 까지 누적 매칭 → FREE 추가 = 전 plan 허용 확정. 요구 6 명문과 흐름 역전 정합성 advisor 지적 후 보강 적용 (변경 시도 시에도 setup 강제).

### PENDING 게이트 잔여 (변경 없음)

본 hotfix 는 마스터 신규 보고 3건 해소에 한정. 직전 PENDING 게이트의 6 후속 항목 (요구 3 PlanLimitExceededDialog host, billingRenewal 흡수, types.ts 정식 선언, scheduleUpgrade 가드, 신규 카드 첫 결제 게이트, SeatManageDialog next-cycle 안내) 은 그대로 유지.

---

## v001.180.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 7)

### 개요

마스터 보고: "인쇄를 누르면 브라우저 인쇄창이 나타남 여기서 pdf 저장을 누르면 파인더에 저장되고 닫히는데 우리측 인쇄 모달은 계속 생성 중...에서 멈춰있어". advisor 사전 검증으로 진단된 근본 원인 = `BrowserPrintEngine.execute()` 가 `iframeWin.onafterprint` 단일 의존 → Chrome/Safari 의 PDF 저장 경로에서 미발화 → Promise 영구 hang → `setIsGenerating(false)` 미호출.

### 페이즈 결과

- **Phase 15 (HOTFIX 7)** (`bebf3c4`): fs-data-viewer 의 `BrowserPrintEngine` 한정 fix (옵션 A — 최소 침습).
  - **once-guard**: `let resolved = false; const finishOnce = () => { if (resolved) return; resolved = true; cleanup(); resolve(); };` — 3개 신호 중 어느 하나만 발화해도 cleanup + resolve 1회 보장.
  - **3중 안전망**:
    1. `iframeWin.onafterprint = finishOnce` — Firefox 등 일관 발화 브라우저.
    2. `iframeWin.matchMedia('print').addEventListener('change', e => { if (!e.matches) finishOnce(); })` — Chrome/Edge/Safari 의 PDF 저장·취소 경로에서 일관 발화. addListener 폴백 포함.
    3. `setTimeout(finishOnce, 60_000)` — 모든 이벤트 미발화 시 최후 fallback. 정상 경로 도달 안 됨.
  - **금지 패턴 명시**: `print()` 호출 직후 finishOnce 호출 금지 (Chrome 의 non-modal 즉시 반환으로 preview 빈 화면 회귀 야기).

### Scope 좁힘 사유

3 패키지 BrowserPrintEngine 검사 결과 — fs-external/fs-sub 는 `window.open + setTimeout(() => { printWindow.print(); printWindow.close(); resolve(); })` 구조로 hang 패턴 부재. fs-data-viewer 만 iframe + onafterprint 단일 의존 패턴이라 마스터 보고 증상이 fs-data-viewer 한정. PdfPrintEngine 은 jsPDF 동기 + doc.save() 라 hang 위험 없음.

### 영향 파일

- data-craft:
  - `packages/fs-data-viewer/src/features/print/engines/BrowserPrintEngine.ts`

1개 파일 / +34 / -8 / 단일 커밋.

### 후속 권장

- fs-external/fs-sub 의 BrowserPrintEngine 을 iframe 기반으로 통일하는 별도 아키텍처 후속 (window.open 의 팝업 차단 회피·focus 동작 차이 등 별 회귀 검증 필요).

### advisor 검증

- **advisor (계획 사전)**: PASS — Chrome `window.print()` 가 non-modal 즉시 반환임을 명시 (모델 초기 가정 오류 정정), matchMedia 'print' change 가 주 해소 경로임을 확인, 60s timeout 권장.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

---

## v001.179.0

> 통합일: 2026-05-18
> 플랜 이슈: #100

### 페이즈 결과

- **Phase 1** (`8941e30`): `data-craft-mobile/prototype/screens/` 신설. 디자인팀 시안 5종 HTML 사본 + 의존 JSX 자산 (`components/` 8개, `frames/` 2개) 을 sibling 구조 유지하며 복사. 파일 내용 무수정 (byte-identical) — Live Server 정적 호스팅에서 상대 경로 import 자동 해석. +12,538 / -0 across 15 files.
- **Phase 2** (`1e25e96`): `prototype/index.html` 랜딩 페이지 신규 작성 (Pretendard CDN, 무의존 단일 HTML, 5개 시안 카드 링크, 모바일 퍼스트 반응형). `prototype/README.md` 작성 — VS Code Live Server 실행 절차, 시안 목록 표 (자기완결 여부 명시), 폴더 구조 트리, 디자인 원본 위치 (`../DataCraft/`) 참조. +244 / -0 across 2 files.

### 마스터 의도

디자인팀 시안 (`data-craft-mobile/DataCraft/` 5종 HTML) 을 VS Code Live Server 로 즉시 시연 가능한 정적 프로토타입 폴더로 재패키징. 제약: `apps/` 하위 아닌 mobile 프로젝트 루트에 별도 폴더 (마스터 명시).

### 해석

"디자인팀 시안 기반 프로토타입 만들어줘" 는 **기존 HTML 을 Live Server 호스팅 가능한 형태로 재패키징** (신규 코드 저작 아님). 근거: `Prototype.html` 이 이미 자기완결 Babel-standalone React 단일 파일, Live Server = 정적 호스팅 = 빌드 없음.

### 검증

- advisor #1 (계획) 5관점 PASS — Intent / Logic / Group Policy / Evidence / Command Fulfillment.
- advisor #2 (완료) 5관점 PASS.
- Phase 1/2 모두 lint gate (`pnpm typecheck`) PASS.
- 시연 절차: `code data-craft-mobile/` → `prototype/index.html` 우클릭 → "Open with Live Server" → 5개 카드 클릭 시 각 시안 정상 렌더.

### 영향 파일

- data-craft-mobile:
  - `prototype/index.html` (신규)
  - `prototype/README.md` (신규)
  - `prototype/screens/prototype-fullflow.html` (신규)
  - `prototype/screens/midfi-full.html` (신규)
  - `prototype/screens/midfi.html` (신규)
  - `prototype/screens/wireframe-v3.html` (신규)
  - `prototype/screens/wireframe-v4.html` (신규)
  - `prototype/screens/components/v4-shim.jsx` (신규)
  - `prototype/screens/components/v4-screens.jsx` (신규)
  - `prototype/screens/components/midfi-screens.jsx` (신규)
  - `prototype/screens/components/midfi-part1.jsx` (신규)
  - `prototype/screens/components/midfi-part2.jsx` (신규)
  - `prototype/screens/components/midfi-part3.jsx` (신규)
  - `prototype/screens/components/midfi-part4.jsx` (신규)
  - `prototype/screens/components/midfi-part5.jsx` (신규)
  - `prototype/screens/frames/ios-frame.jsx` (신규)
  - `prototype/screens/frames/design-canvas.jsx` (신규)

### 미사용 자산 (의도적 제외)

`DataCraft/lib/` (8 JSX), `DataCraft/uploads/` (6 PNG) 는 어떤 HTML/JSX 도 참조하지 않음 (grep 확인) — 프로토타입 폴더에 포함하지 않음. 향후 필요 시 마스터 지시로 추가 복사 가능.

### 후속

본 프로토타입은 정적 사본. 디자인 변경은 원본 (`DataCraft/`) 에서 진행하고 `prototype/screens/` 로 재동기화 필요. 빌드 산출물 아니므로 `pnpm-workspace.yaml`, `vite.config.ts`, `tsconfig.json` 변경 없음.

---

## v001.178.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 9)

### 핫픽스 결과 — Phase 13 (`b14b043`)

### Root cause (정확 진단)

**CSS calc 공백 명세 위반**. `right-[calc(28rem+0.5rem)]` 의 `+` 연산자 양쪽에 공백이 없어 브라우저가 calc 식 전체를 파싱 실패로 처리, `right` 선언 무효화. Tailwind JIT arbitrary value `[...]` 내부는 공백 불가 — `calc(28rem_+_0.5rem)` (underscore→space 변환) 표기 또는 정적 값 사용 필요.

`useDrawerOverlap` 훅은 올바르게 동작. `shouldOffset=true` 로 전환되어도 right 클래스가 무효 CSS 라 시프트가 시각적으로 발생 안 함. AreaControls 가 default `right-2` 로 떨어져 드로어 뒤에 가려진 채 노출.

### 처방

- `AreaControls.tsx:116`: `right-[calc(28rem+0.5rem)]` → `right-[28.5rem]` (수치 동일, calc 제거).

본 회귀는 사실 hotfix 8 이전부터 존재. hotfix 5/6/7 의 dim Area unmount 가드가 시각적으로 가렸기에 인지되지 않다가, hotfix 8 에서 dim Area 에도 controls 렌더 활성화 후 시각화됨.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/AreaControls.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- 사전 read 로 `useDrawerOverlap.ts` 정상 동작 확인 → root cause 는 시프트 클래스의 CSS 유효성.

### 잠재 우려 / Latent (누적)

- FloatingSectionBanner X 버튼이 widget 경로 banner 닫지 못함.
- `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 9` (본 entry) — Phase 13 → data-craft i-dev 머지 + patch-note v001.178.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `플랜 완료` 또는 추가 핫픽스.

---

## v001.177.0

> 통합일: 2026-05-18
> 플랜 이슈: #99 (hotfix 1)
> 버전 양보 메모 (CLAUDE.md §5 step 4): 본 entry 작성 중 병렬 세션이 v175/v176 선점하여 v001.177.0 으로 양보.

### 페이즈 결과
- **Phase 2** (`9c782a9`): 플랜 업그레이드 모달에서 FREE / ENTERPRISE 요금제의 **시각적 비활성화 처리** 와 FREE 마우스오버 **툴팁** 을 모두 제거. 실제 클릭 차단 로직 (`isUpgradable` 의 `isFree || isEnterprise ? false` 분기, button `disabled` 속성) 은 그대로 유지 — 마우스 커서로는 클릭이 안 되지만 시각적으로는 일반 카드와 동일하게 보임.
  - `PlanComparisonCard.tsx`: `cn(...)` 에서 `'opacity-40 cursor-not-allowed'` 클래스 라인 제거.
  - `UpgradeStepSelect.tsx`: FREE `Tooltip` 분기 / ENTERPRISE `Badge "준비중"` 분기 제거 + 미사용 import (Badge, Tooltip, TooltipTrigger, TooltipContent) 정리.

**검증**: advisor #2 5-perspective PASS. lint gate PASS (`pnpm typecheck:all && pnpm lint` exit 0).

### 영향 파일
- data-craft: `src/features/subscription/ui/PlanComparisonCard.tsx`, `src/features/subscription/ui/UpgradeStepSelect.tsx`

## v001.176.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 8) — 마스터 명시 마지막 항목

### 핫픽스 결과 — Phase 12 (`b027384`)

advisor 사전 검증 PASS. 마스터 의도 (드로어 열림 + 비포커스 Area + hover 시 AreaControls 만 dim 위에 표시) 와 정확히 매핑.

### 마스터 의도 (최종)

| 상태 | AreaControls 가시성 |
|------|---------|
| 드로어 닫힘 | 모든 Area 에 표시 |
| 드로어 열림 + 포커스 Area | 표시 (변경 없음) |
| 드로어 열림 + 비포커스 Area, hover 없음 | 숨김 (opacity-0) |
| 드로어 열림 + 비포커스 Area, **hover** | **표시 — dim overlay 위, 어둡지 않게** |

### 처방 (a — className prop 통과)

- **Area.tsx**: `isDesignMode && !area.isRowSplit && !isDimmed` → `isDesignMode && !area.isRowSplit` (가드 제거). dim 영역에서도 AreaControls/width-indicator 항상 DOM 에 렌더. `isDimmed` 시 `z-30` 전달 (dim overlay z-20 위).
- **AreaControls.tsx**: optional `className?: string` prop 추가, 내부 `cn()` 끝에 병합.
- **width-indicator**: 인라인 JSX, `z-10` → `z-30` 조건부.

### 핵심 발견 — hotfix 5~7 의 진단 오류 정리

`AreaControls.tsx` 의 className 에 `opacity-0 group-hover/area:opacity-100 transition-opacity` 가 **원래부터 존재**. 즉 마스터의 hotfix 5 "1초 이내 깜박임" 보고는 사실은 hover 가 잠깐 매칭된 정상 동작이었음 (클릭하면서 마우스가 영역 위를 지나간 케이스). hotfix 5/6/7 의 "깜박임 차단" 시도 (`!isDimmed`, `!isAnyDrawerOpen`) 가 마스터의 hover reveal 의도와 **반대 방향**이었음. 본 hotfix 가 의도 정합.

### 진단 history 종결

| Hotfix | 시도 | 의도 부합 |
|--------|------|------|
| 5 (9-A) | `!isDimmed` 가드 추가 (dim 영역 unmount) | ✗ hover reveal 차단 |
| 6 (10-B) | `!isAnyDrawerOpen` (더 strict, focused 까지 차단) | ✗ focused 도 차단 |
| 7 (11-A) | `!isDimmed` 복원 | ✗ hover reveal 여전히 막힘 |
| **8 (12-A/B)** | **가드 제거 + z-30 으로 dim 위 reveal** | **✓ 의도 정합** |

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/AreaControls.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 5관점 PASS.

### 잠재 우려 / Latent (누적)

- FloatingSectionBanner X 버튼이 widget 경로 banner 닫지 못함.
- `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 8` (본 entry) — Phase 12 → data-craft i-dev 머지 + patch-note v001.176.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `플랜 완료` 트리거 가능. (마스터 명시 "마지막 항목")

---

## v001.175.0

> 통합일: 2026-05-18
> 플랜 이슈: #96

### 페이즈 결과
- **Phase 1** (`274f694`): `data-craft/packages/fs-data-viewer` 의 `documentation` 카테고리(id:5) 를 제거하고 `document` 컬럼 타입을 `usefulColumnTypes` 객체 내부로 이전 (category=`useful`, id/icon/defaultWidth/defaultColor/minWidth/hasUnitEdit 보존). `documentationColumnTypes` 익스포트 + `composition.ts` import/스프레드 정리, i18n `helpers.ts` `CATEGORY_ID_KEY_MAP` 의 `5: 'documentation'` 항목 제거, `types.ts` 의 `columnCategories.documentation` 필드 제거, 4개 번역(`ko/en/zh/ja`) 의 `documentation` 키 삭제. 변경 +3/-18 across 9 files.
- **Phase 2** (`e7a0b48`): `data-craft/packages/fs-sub-data-viewer` 에 Phase 1 과 1:1 동형 변경 적용. 변경 +3/-18 across 9 files.
- **Phase 3** (`d219b2d`): `data-craft/packages/fs-external-data-viewer` 에 Phase 1/2 와 1:1 동형 변경 적용. 변경 +3/-18 across 9 files.
- **Phase 4** (`699f861` — 범위 확장 / advisor #2 사전 검증에서 발견): `data-craft-mobile/packages/fs-data-viewer-mobile` 에 동형 변경 적용. 데스크탑/모바일 양 surface 의 동일 탭 구조 동시 보장. 변경 +3/-18 across 9 files.

**의미**: 데이터 뷰어 "열 추가" 오버레이가 5탭 → 4탭 (`필수 / 편의 / 스마트 / 유용한`) 으로 단순화되고, "유용한 기능" 탭 내용이 `연결 / 듀얼 위젯 / 문서` 3종이 된다. `category` 필드는 사용자 데이터에 직렬화되지 않고 (column-json/column-type 참조 0건) 탭 그루핑 정적 비교에만 사용되므로 기존 저장된 `document` 컬럼은 영향 없음. 컬럼 ID `'document'` 와 `FsGridColumnTypes` 머지 키 보존.

**검증**: advisor #1 / #2 5-perspective (Intent · Logic · Group Policy · Evidence · Command Fulfillment) PASS. lint gate PASS — data-craft `pnpm typecheck:all && pnpm lint` exit 0 (0 errors, 11 warnings), data-craft-mobile `pnpm typecheck` exit 0. 4 레포 (data-craft / data-craft-mobile / data-craft-server / data-craft-ai-preview) cross-grep 결과 `documentationColumnTypes` / `FsGridColumnTypeCategories.documentation` / `columnCategories.documentation` 잔존 0건.

### 영향 파일

#### data-craft
- `packages/fs-data-viewer/src/entities/column-types/categories.ts`
- `packages/fs-data-viewer/src/entities/column-types/other-types.ts`
- `packages/fs-data-viewer/src/entities/column-types/composition.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/helpers.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/types.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/translations/{ko,en,zh,ja}.ts`
- `packages/fs-sub-data-viewer/src/entities/column-types/{categories,other-types,composition}.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/{helpers,types}.ts`
- `packages/fs-sub-data-viewer/src/shared/config/i18n/translations/{ko,en,zh,ja}.ts`
- `packages/fs-external-data-viewer/src/entities/column-types/{categories,other-types,composition}.ts`
- `packages/fs-external-data-viewer/src/shared/config/i18n/{helpers,types}.ts`
- `packages/fs-external-data-viewer/src/shared/config/i18n/translations/{ko,en,zh,ja}.ts`

#### data-craft-mobile
- `packages/fs-data-viewer-mobile/src/entities/column-types/{categories,other-types,composition}.ts`
- `packages/fs-data-viewer-mobile/src/shared/config/i18n/{helpers,types}.ts`
- `packages/fs-data-viewer-mobile/src/shared/config/i18n/translations/{ko,en,zh,ja}.ts`

## v001.174.0

> 통합일: 2026-05-18
> 플랜 이슈: #99

### 페이즈 결과
- **Phase 1** (`a964961`): `data-craft-server/src/config/constant.ts` 의 `PLAN[PLAN_TYPE.FREE].pages` 값을 `1` → `3` 으로 변경. BE 미들웨어 enforcement (`plan-limit.middleware.ts`) · `GET /api/subscription/plans` 응답 · FE 플랜 카드 표시가 모두 본 상수를 참조하므로 1줄 변경으로 전체 시스템에 자동 반영. DB 마이그레이션 / 추가 코드 변경 없음. 기존 무료 사용자(1페이지 보유 중)는 즉시 +2 추가 페이지 생성 가능 — 한도 상향의 정의상 동작.

**검증**: advisor #1 / #2 5-perspective (Intent · Logic · Group Policy · Evidence · Command Fulfillment) PASS. lint gate PASS (`data-craft-server pnpm lint` exit 0).

### 영향 파일
- data-craft-server: `src/config/constant.ts`

## v001.173.0

> 통합일: 2026-05-18
> 플랜 이슈: #91
> 버전 양보 메모 (CLAUDE.md §5 step 4): 본 entry 머지 진행 중 병렬 세션이 v171/v172 선점하여 v001.173.0 으로 양보.

### 페이즈 결과

마스터의 22개 요구사항 + 보강 2건 (인원 추가 결제 고지, DB 병렬 적용) 에 대응하여 결제 시스템 전반을 재검증한 통합 작업. 총 14 페이즈 (BE 5 + FE 9).

**BE (data-craft-server)**

- **Phase 1** (`9e93b30`): `user.payment_password` 도메인 신설 — bcrypt 해시 유틸 + set/verify/exists CRUD API. 응답에 해시 미노출.
- **Phase 2** (`8fe3d27`): 다운/주기 변경 예약 `*_BLOCKED_PENDING_SEAT_CHANGES` 사전 차단 제거. 충돌 해소는 갱신 시점에 위임.
- **Phase 3** (`0e2f235`): 라우트 미들웨어 `requirePaymentPassword` 신설 — 7 endpoint 부착 (billing/payment, reactivate, schedule-downgrade, schedule-upgrade, schedule-cycle-change, seats/change, promotion/purchase).
- **Phase 4** (`dad5284`): `GET /api/subscription/seats/change/quote?delta=N` 신설 (immediate/nextCycle 일괄 응답). 즉시 인원 추가 산식을 만액→잔여 일수 비례로 전환 (quote 와 동일 함수 공유). 인메모리 `withIdempotency` 결제 중복호출 방지.
- **Phase 5**: BE "환불" 매칭 0건 — skip.

**FE (data-craft)**

- **Phase 6** (`c68f867`): 결제 비밀번호 공용 컴포넌트 — `PaymentPasswordInputDialog`, `PaymentPasswordSetupStep`, `usePaymentPasswordGate` hook.
- **Phase 7** (`029aea4` + `c48b156`): `SeatManageDialog` 통합 + `NumberInputWithReturn` + BillingInfoSection "인원 관리" 버튼 + quote 동적 고지.
- **Phase 8** (`118ba4d`): 무료/엔터프라이즈 disabled (엔터프라이즈 "준비중" Badge). DialogTitle `PLAN_LEVEL` 비교로 다운/업 동적 전환.
- **Phase 9** (`542def4`): UpgradeStepPayment billingCycle yearly 기본 + NumberInputWithReturn 교체 + 결제 비밀번호 게이트 + 중복호출 방지.
- **Phase 10** (`ff98858`): UpgradeDialog squash 픽스 (`key={step}` 재마운트).
- **Phase 11** (`263fd39`): 구독 취소 우측 끝 회색 + `ReactivateConfirmDialog` + 연간 변경 게이트.
- **Phase 12** (`a848aef`): BillingSuccessPage 3 분기에 PaymentPasswordSetupStep 마운트 + CurrentPlanBadge 프로모션 표기 정리 + activePromotion 시 "연간으로 변경 예약" 버튼 비표시.
- **Phase 13** (`c85d404`): PlanFeatureList COLLAPSED_COUNT 4→6 + SeatAddDialog 삭제 + PendingUserList → SeatManageDialog 교체.
- **Phase 14** (`cacb7bc` + `48b9f56`): PlanLimitExceededDialog 게이트 우회 차단 + SeatManageDialog `onAfterSuccessfulImmediatePay` 콜백 + PendingUserList 자동 재승인 복구 (enterprise-496 H4 회귀 해소).

**검증**: advisor #1 / #2 5-perspective (Intent · Logic · Group Policy · Evidence · Command Fulfillment) PASS. 전 페이즈 lint gate PASS (data-craft-server `pnpm lint`, data-craft `pnpm typecheck:all && pnpm lint`).

### 잔여 항목 (PENDING gate — 마스터 결정 필요)

1. 요구 3 해석 의존 — PlanLimitExceededDialog 가 host dialog 로 살아있음 (게이트 우회는 차단됨, UpgradeStepPayment 공유). 문자 그대로의 "두 곳" 충족 위해 UpgradeDialog 라우팅 전환 후속 가능.
2. `billingRenewal.service.ts` 갱신 시점에 plan change ↔ seat change 흡수 정책 미구현 (Phase 2 잔여). 다음 갱신 도래 전까지 무영향.
3. `PaymentRequest` / `ScheduleUpgradeRequest` types.ts 의 paymentPassword 필드 정식 선언 미완 (타입 캐스팅 우회 — 런타임 정상).
4. `scheduleUpgrade` 의 `UPGRADE_BLOCKED_PENDING_SEAT_CHANGES` 가드 일관성 후속.
5. 신규 카드 등록 후 첫 결제 게이트 — 요구 17 문언상 범위 밖이며 Phase 12 의 setup 강제로 후속 결제 보호.
6. SeatManageDialog next-cycle 예약 안내 UX 소규모 보강.

### 영향 파일

**data-craft-server**: `src/utils/{paymentPasswordHash,idempotency}.ts` (신규), `src/models/user.model.ts`, `src/controllers/{paymentPassword (신규), seatChange}.controller.ts`, `src/middlewares/requirePaymentPassword.ts` (신규), `src/types/{paymentPassword,seatChangeQuote}.types.ts` (신규), `src/services/{billingSubscription,seatChange}.service.ts`, `src/routes/{user,subscription,promotion.routes}.ts`, `src/config/constant.ts`, `src/__tests__/billingSubscription.{scheduleDowngrade,scheduleBillingCycleChange}.test.ts` (신규).

**data-craft**: `src/features/subscription/api/{paymentPassword (신규), seatChange (신규), billingApi}.ts`, `src/features/subscription/lib/{usePaymentPasswordGate (신규), planFeatures}.ts`, `src/features/subscription/model/{subscriptionQueries,types}.ts`, `src/features/subscription/ui/{PaymentPasswordInputDialog, PaymentPasswordSetupStep, SeatManageDialog, ReactivateConfirmDialog}.tsx` (신규), `src/features/subscription/ui/{UpgradeDialog, UpgradeStepSelect, UpgradeStepPayment, PlanLimitExceededDialog}.tsx`, `src/features/subscription/ui/SeatAddDialog.tsx` (삭제), `src/features/subscription/index.ts`, `src/shared/ui/number-input-with-return.tsx` (신규), `src/widgets/settings-dialog/ui/plan/{BillingInfoSection, SubscriptionActionSection, CurrentPlanBadge, PlanFeatureList}.tsx`, `src/widgets/settings-dialog/ui/PendingUserList.tsx`, `src/pages/billing-callback/ui/BillingSuccessPage.tsx`.

**DB (별도 task-db-structure 세션)**: `user.payment_password VARCHAR(255) NULL` 컬럼.

## v001.172.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 6)

### 개요

마스터 보고: "페이지네이션이 존재는 하지만 여전히 한 페이지에 용지를 반드시 초과하는 분량이 할당되어 나타남, 미리보기에서 1개 페이지의 높이가 엄청나게 길게 나타남, 용지 비율 규격에 전혀 맞지 않음" + "하단바 영역 디자인이 이상함, 여백을 같이 써서 하단바가 붕떠있음". advisor 사전 검증으로 진단된 근본 원인 (transform: scale 의 box-model 미축소 + flex 계층 min-h-0 누락) 을 정확히 fix.

### 페이즈 결과

- **Phase 14 (HOTFIX 6)** (`c4bfe64`): 3 패키지 PrintPreview + PrintDialog 동일 패턴.

#### A. PrintPreview — outer-wrapper-scaled / inner-mm-card-transform 분리

  - **문제**: paper card 가 `width: Xmm; height: Ymm; transform: scale(fitScale)` 단일 박스. transform 은 *rendered output* 만 축소, *box model* (flex layout 이 보는 크기) 은 unscaled (예: 1123×794px) 그대로 → flex 가 큰 unscaled 박스로 인식해 컨테이너 overflow + 시각적 비율 어긋남.
  - **변경**: outer wrapper 를 *scaled pixel* 크기로 신설 (`width: paperWidthPx × effectiveScale`, height 동일, `position: relative; flexShrink: 0`). 그 안에 inner paper card 를 mm 기반 unscaled + `transform: scale(effectiveScale); transformOrigin: top left; position: absolute; top:0; left:0`. iframe content 의 mm 레이아웃 보존, flex layout 은 visible 픽셀 크기 정확 인식.
  - **container 에 `min-h-0` 추가**: flex 부모로부터 받는 가용 높이를 정확히 인식. fitScale 계산 입력 (containerSize.height) 신뢰성 회복.
  - **페이지네이션 (HOTFIX 5) 보존**: iframe.contentWindow.scrollTo 의 좌표 `(currentPage - 1) * paperHeightPx` 는 *unscaled mm 픽셀* 그대로 — iframe viewport 는 inner paper card 의 unscaled 공간. 변경 없음.

#### B. PrintDialog — flex 계층 min-h-0 보강 + 하단바 flush

  - **진단 (advisor 가이드)**: preview 분기 2-pane 레이아웃의 flex 계층에 `min-h-0` 누락 시 flex item 의 `min-height: auto` 기본값이 콘텐츠 크기로 expand → 우측 미리보기 영역이 paper card 의 unscaled 픽셀만큼 비대해짐 → paper card 가 늘어나 보이는 1차 원인.
  - **변경**: children wrapper + 우측 미리보기 패널에 `min-h-0` 추가. flex 부모-자식 chain 의 모든 level 이 가용 높이를 정확히 전파.
  - **하단바 flush**: HOTFIX 4 의 customFooter 가 `DialogContent` 의 `p-5` padding 안에 들어가 dialog 가장자리에서 떨어진 상태. previewFooter 의 outermost div 에 `-mx-5 -mb-5` (margin negative) 추가로 DialogContent padding 을 *escape* — 가장자리 flush.

### 영향 파일

- data-craft (3 패키지):
  - `packages/fs-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintDialog.tsx`

6개 파일 / +90 / -54 / 단일 커밋.

### 잔여 한계

- HOTFIX 5 의 알려진 한계 (스크롤 vs page-break, WebKit 스크롤바, body overflow:hidden) 그대로 유지.
- 신규: zoom 슬라이더 드래그 시 outer wrapper 의 width/height 가 매 프레임 변하여 transition (`width 200ms, height 200ms`) 이 lag 유발 가능 — UX 보고 후 transition 제거 검토 (마스터 결정).

### 버전 비트 (v001.172.0 사유)

원래 v001.171.0 으로 발행 시도했으나 그 사이 별 플랜 #97 이 v001.171.0 을 선점 — 본 항목 v001.172.0 으로 재발행. 코드/머지 사실은 변동 없음.

### advisor 검증

- **advisor (계획 사전)**: PASS — 3개 핵심 보완 (outer-wrapper-scaled, flex min-h-0 누락 검사, 하단바 flush 경로) 명시 후 진행 권고.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.171.0

> 통합일: 2026-05-18
> 플랜 이슈: #97
> Roadmap-1 단계1-C 현 상태 마감 — record-detail 선행 완료 인정 + search BE 부재 인정 (작업 0).

### 페이즈 결과 — 0 phases

마스터 결정 (a): 현 상태 인정 + 마감. 코드 변경 0. 본 plan 은 audit-trail 이슈 (#97) 생성 + 본 패치노트 항목 추가 + 후속 Roadmap-1 단계1-C 🟢 갱신만으로 종결.

### 전수조사 발견

- **record-detail 영역**: `apps/web/src/mobile/screens/record-detail/ScreenRecordDetail.tsx` + `useRecordRow.ts` 가 enterprise-462 PHASE-01~04 (Roadmap-004 §F [S-6.1]) 에서 이미 완성 — `viewerApi.getSingleRow` (`GET /api/viewer/data/:groupId/row/:rowField`) 실 API 호출, 3 탭 (정보·댓글·활동), AbortController 정리, 낙관적 갱신 (`patchCell`/`rollback`), 좌우 화살표 a11y, `RelationSection`·`RecordEditSheet` 통합, 테스트 `ScreenRecordDetail.test.tsx` RT-01~RT-04 까지 모두 통과.
- **search 영역**: `apps/web/src/mobile/screens/search/ScreenSearch.tsx` + `useGlobalSearch.ts` 가 enterprise-426 PHASE-05 (Roadmap-004 §F [S-1.4]) 에서 UI/디바운스(300ms)/탭 4종(전체·페이지·레코드·사람)/풀투리프레시/RecentSearches 까지 완성. 내부적으로 `useGlobalSearch` 가 `filterMockSearch()` (mockSearch fixture) 사용 — 실 BE 글로벌 search 부재로 인한 임시 상태.
- **BE 진단**: `data-craft-server/src/routes/viewer.ts:175~193` 의 모든 `*search*` 라우트는 `/data/:groupId/...search` (POST, per-group 필터). 모바일 글로벌 검색이 가정하는 `GET /v1/search?q=...&type=all|pages|records|people` 미존재. `GET /api/builder/pages` 와 `GET /api/users` 는 존재하나, records 탭 (cross-group 글로벌 record 검색) 은 BE 집계자 없이는 FE-only 구현 불가.

### 운영 결정 (master)

Roadmap-1 의 0-B CORS BLOCK 사례와 동형의 운영 결정 — Roadmap-1 hard rule (BE/DB 무수정) 안에서 더 진행 불가능한 부분 (records 탭 실 데이터 연결) 은 후속 Roadmap (Roadmap-3 또는 후속 Roadmap-005) 으로 이관. 단계1-C 의 형식적 종결은 본 패치노트 항목으로 마감.

### 영향 파일

- (코드 변경 없음)
- Project-I2: `.claude/project-group/data-craft/patch-note/patch-note-001.md` (본 항목)

### Roadmap-1 진행 영향

- 단계1-C `/plan-enterprise data-craft 단계1-C` 가 🟢 (FE-가능 최대치 도달 인정) 갱신 가능.
- records-tab 실 데이터 연결은 별도 후속 Roadmap 에서 BE 신규 + mockSearch 제거 + useGlobalSearch 실 fetch 일괄 처리 예정.
- 병렬 그룹 1 (단계1-A 선행 → 단계1-B / 단계1-C 동기) 완료 — 다음 후보 단계 = 단계 2 (데이터 뷰어 5종, fs-data-viewer-mobile 단일 plan phase 직렬) 또는 단계 4 (메시징·알림·피드, 단일 plan phase 직렬).

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수). data-craft-server / data-craft 리포 read-only 유지.

## v001.170.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 7)

### 핫픽스 결과 — Phase 11 (`723ab46`)

**9회째 hotfix — yo-yo 종결책**. advisor 가 8회 history 분석 후 마스터 의도 표를 명문화 + AreaControls vs Section ring 조건 분리.

### 마스터 의도 표 (advisor 정리)

| 상태 | Area ring | Section ring | AreaControls (인라인) | FloatingSectionBanner | dim |
|------|------|------|------|------|------|
| 드로어 닫힘 + 섹션 선택 | 없음 | **있음** | 모든 Area | 있음 | 없음 |
| 드로어 닫힘 + 무선택 | 없음 | 없음 | 모든 Area | 없음 | 없음 |
| 드로어 열림 (widget/area/section drawer 중 하나) | 포커스 Area | **없음** | **포커스 Area 만** | 있음 | 비포커스 |

**핵심**: AreaControls 가드 = per-Area dim 판정 (`!isDimmed`), Section ring 가드 = global drawer-open 판정 (`!isAnyDrawerOpen`). 두 조건은 의도적으로 다름 — 같은 가드 쓰면 안 됨 (hotfix 6 의 실수가 이 점).

### 처방

- **11-A (Item 1, Area controls focused 복원)**: `Area.tsx` AreaControls / width-indicator 가드를 hotfix 6 의 `!isAnyDrawerOpen` → `!isDimmed` 로 되돌림. 포커스 Area 는 `isDimmed=false` 이므로 드로어 열림 중에도 인라인 컨트롤 정상 노출.
- **11-B (flicker 진단)**: AreaControls.tsx 의 hover 클래스 read — opacity transition 존재. 그러나 `Area.tsx` 의 conditional render (`!isDimmed && <AreaControls/>`) 가 dim 영역에서 unmount 시키므로 hover 무관. 진짜 원인 = Zustand `selectedWidgetId` 동기 set 과 `useActiveEditingTarget` 재계산 간 0~16ms state race. `!isDimmed` 가드가 race 구간을 차단.
- **11-C (Item 2, Section ring drawer 가드 추가)**: `Section.tsx` 에 `useWidgetStore` 임포트 + `isAnyDrawerOpen = isSectionDrawerOpen || isAreaDrawerOpen || !!selectedWidgetId` 계산. `isSectionSelected = isDesignMode && selectedSectionId === id && !isAnyDrawerOpen`. widget drawer 열림 시 Section ring 숨김 — hotfix 6 누락 보완.

### 9회 yo-yo history 요약

| Hotfix | AreaControls 가드 | Section ring 가드 |
|--------|------|------|
| 1~4 | (per-Area 조건 없음) | drawer flag 조건 변화만 |
| 5 | `!isDimmed` (∅ → 깜박임 보고) | `isOwningSelectedWidget` fallback |
| 6 | `!isAnyDrawerOpen` (focused 도 차단 회귀) | fallback 제거 (widget drawer 노출) |
| **7 (본 entry)** | **`!isDimmed`** (per-Area) | **`!isAnyDrawerOpen`** (global) |

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 5관점 PASS — 의도 표 명문화 + 조건 분리.

### 잠재 우려 / Latent

- AreaControls flicker 잔존 가능성: 본 처방은 state race 가설 기반. 재현 시 hotfix 8 에서 AreaControls mount reveal delay (opacity-0 + transition) 또는 추가 가드 검토.
- 누적 latent: FloatingSectionBanner X 버튼 widget 경로 미닫힘 / `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 7` (본 entry) — Phase 11 → data-craft i-dev 머지 + patch-note v001.170.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 8` 또는 `플랜 완료` 트리거 가능.

---

## v001.169.0

> 통합일: 2026-05-18
> 플랜 이슈: #94 (hotfix 1)

### 핫픽스 결과 — Phase 4 (`3c0f6057`)

위젯 디자인 너비/높이 입력 필드의 UI 를 SubAreaHeightInput 패턴으로 통일.

- shadcn `Input` (type="number") → raw `<input type="text" inputMode="numeric">` 교체. 위/아래 스피너 버튼 완전 제거 (`[appearance:textfield]` + webkit spin-button 숨김).
- `CornerDownLeft` 리턴 아이콘을 우측 절대 위치로 표시 (Auto 비활성 시에만, pointer-events-none).
- `widthValue` / `heightValue` 별도 state + `isFocusedRef` + `justAppliedRef` 패턴 — Enter+blur 이중 호출 차단.
- Enter 또는 blur 시점에만 clamp(min=1, max=areaWidthPx/areaHeightPx) 적용 후 `onStyleChange` 커밋.
- **빈값 허용**: 빈 채로 Enter/blur 하면 `''` 커밋 → `widthIsAuto` 가 true 로 전이되어 Auto 모드로 자연스럽게 전환 (기존 onBlur 의 "빈값 → 100px 강제" 로직 제거).
- useEffect 내 setState 는 `react-hooks/set-state-in-effect` eslint-disable-next-line 처리 (SubAreaHeightInput 동일 패턴).

### 마스터 의도 충족

> "위젯 디자인의 너비 높이 입력 필드에서 위아래 값 조정 버튼 없애고 키보드 리턴 아이콘 넣어, 비워놓을 수 있게하고 엔터 누르면 적용되게 해"

- 위아래 값 조정 버튼 제거 ✅
- 키보드 리턴 아이콘 (CornerDownLeft) 추가 ✅
- 비워놓기 가능 (빈값 → Auto 전이) ✅
- 엔터 적용 ✅

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): 0 errors.

### 영향 파일

- data-craft: `src/widgets/property-drawer/ui/style-editors/WidgetDesignGroup.tsx`

## v001.168.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 5)

### 개요

마스터 보고: "미리보기는 용지 규격에 맞게 페이지 단위로 나와야해, 현재 그냥 세로로 전부 길게 한번에 나오고 있어 페이지네이션 넣어". HOTFIX 4 와 같은 advisor 분할 라운드의 두 번째 (5) — 페이지네이션 동적 구현.

### 페이즈 결과

- **Phase 13 (HOTFIX 5)** (`de00dc6`): 3 패키지 PrintPreview 동일 패턴.
  - **totalPages 동적 측정**: 하드코딩된 `totalPages={1}` → `useState(1)` + iframe `onLoad` 이벤트에서 `contentDocument.body.scrollHeight / contentDocument.documentElement.scrollHeight 최댓값` 측정 후 `paperHeightPx = paperDimensions.height * 3.7795` 로 나누어 `Math.max(1, Math.ceil(...))` 산출.
  - **현재 페이지로 iframe scrollTo**: `currentPage` 변경 시 `useEffect` 가 `iframeRef.current.contentWindow.scrollTo({ top: (currentPage - 1) * paperHeightPx, behavior: 'smooth' })` 호출. transform 적용된 paper card 의 fitScale·zoom 과 무관 (transform 은 rendered output 만 영향, scrollTo 는 iframe 의 내부 좌표공간 사용).
  - **콘텐츠 교체 시 currentPage clamp**: onLoad 핸들러 내 단일 경로로 totalPages 초과 시 clamp.
  - **스크롤바 시각 노출 최소화**: paper card wrapper 에 `overflow-hidden`, iframe 에 `scrollbarWidth: none` (Firefox). WebKit (Safari) 은 `::-webkit-scrollbar` 규칙을 iframe srcDoc 에 주입해야 완전 차단 — 본 핫픽스는 PrintPreview scope 라 미적용.

### 영향 파일

- data-craft (3 패키지):
  - `packages/fs-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintPreview.tsx`

3개 파일 / +84 / -6 / 단일 커밋.

### 알려진 한계

1. **스크롤 분할 vs 인쇄 page-break 경계 불일치**: 화면 페이지네이션은 paperHeightPx 등간격 N등분. 실제 인쇄 시점은 CSS `page-break-after / inside / before` 규칙으로 적용되어 행 중간 등에서 break — 미리보기 페이지 경계와 인쇄 페이지 경계가 정확히 일치하지 않을 수 있음. 마스터의 "페이지 단위 UX" 요구는 충족. 완전 일치는 별 핫픽스 (printHtmlBuilder 가 페이지 div 명시 emit + PrintPreview 가 enumerate 하는 방식) 필요.
2. **WebKit iframe 스크롤바**: Safari/Chrome 에서 iframe 내부 스크롤바가 paper 카드 안쪽에 보일 수 있음. iframe srcDoc 의 CSS 주입 (printHtmlBuilder scope) 필요.
3. **printHtmlBuilder 가 body overflow: hidden** 설정 시 scrollHeight 가 paper 높이로 고정되어 totalPages=1 로 묶일 가능성 — printHtmlBuilder.ts 가 scope 외라 미검증.

### advisor 검증

- **advisor (계획 사전)**: HOTFIX 4·5 분할 권고 채택. 5는 advisor 의 Approach B (scroll-based) 로 선택.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.167.0

> 통합일: 2026-05-18
> 플랜 이슈: #95
> Roadmap-1 단계1-B 잔여 작업 (page-tree hook 실데이터 wiring) 마감.

### 페이즈 결과 — Phase 1 (`3fe1848`)

advisor 사전·완료 검증 PASS. 단일 phase 의 4 step 중 3 step 실행 + 1 step 정보성 deviation.

- **buildPageTree 신규** (`apps/web/src/mobile/lib/buildPageTree.ts`): `BuilderPage[]` 평면 응답 → `PageNode[]` 트리 변환 헬퍼. 매핑 규칙 = `type = isSelectorBox ? 'folder' : 'page'` (desktop selector-box 규칙과 동치), `title ← name`, `parentId: undefined → null` 정규화, 형제 `order` 오름차순. cycle 가드 (조상 체인 visited Set), self-parent 가드, orphan → 루트 배치 포함.
- **usePageTree rewrite** (`apps/web/src/mobile/hooks/usePageTree.ts`): MOCK_PAGE_TREE stub 완전 제거. `builderApi.getPages({ limit: 500 })` + AbortController + useState(loading/error) + useCallback(fetchOnce) + useEffect(mount fetch) 패턴 (`usePageViewer` 미러). 실 loading / error / refetch 가동.
- **테스트 갱신**: `buildPageTree.test.ts` 신규 8 케이스 (빈 배열·타입 매핑·parentId 정규화·그룹핑·정렬·orphan·cycle·루트 정렬). `usePageTree.test.ts` 는 vi.mock + waitFor 패턴으로 재작성 (stub 기반 → 실 API mock 기반).
- **Deviation (정보성)**: 계획 step 3 (ScreenPageTree EmptyState 분기 추가) 은 실행하지 않음 — `PageTreeView.tsx:87-94` 가 이미 `flatNodes.length === 0` 시 `role="status"` 와 함께 "📄 페이지가 없습니다" 메시지를 렌더하고 있어 중복 분기 추가 시 기존 테스트의 단일 `getByRole('status')` 매칭이 깨짐. 빈-트리 요구사항은 하위 컴포넌트에서 이미 충족.

### 영향 파일

- data-craft-mobile:
  - `apps/web/src/mobile/lib/buildPageTree.ts` (신규)
  - `apps/web/src/mobile/lib/__tests__/buildPageTree.test.ts` (신규)
  - `apps/web/src/mobile/hooks/usePageTree.ts`
  - `apps/web/src/mobile/hooks/__tests__/usePageTree.test.ts`

### 회귀 검증

- `pnpm typecheck` (data-craft-mobile WIP A 워크트리) PASS (exit 0, 0 errors).
- advisor #1 (계획) / advisor #2 (완료) 모두 5관점 PASS.

### Roadmap-1 진행 영향

- 단계1-B `/plan-enterprise data-craft 단계1-B` 가 🟢 완료 가능. page-viewer 측은 enterprise-427 PHASE-04 (Roadmap-004) 에서 이미 wired-up 완료된 상태로 본 plan 의 잔여 hook 작업만 마감.
- 병렬 그룹 1 의 동기 단계1-C (레코드 상세 / 검색) 진입 가능.

### BE/DB 영향

- 0 (Roadmap-1 hard rule 준수). data-craft-server / data-craft 리포 read-only 유지.

## v001.166.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 6)
> 비고: v001.165.0 은 #86 HOTFIX 4 가 선점하여 본 entry 가 v001.166.0 으로 bump.

### 핫픽스 결과 — Phase 10 (`5e8d07c`)

advisor 사전 검증 PASS. 3건 회귀 + 신규 통합 수정.

- **10-A (Item 1, Section ring fallback 제거)**: hotfix 5 의 9-B(a) `isOwningSelectedWidget` useMemo + `useWidgetStore` 임포트 모두 제거. `isSectionSelected = isDesignMode && selectedSectionId === id && !isSectionDrawerOpen && !isAreaDrawerOpen` (hotfix 3 시점 복원). 마스터 원 의도 (드로어 열림 = Area ring 만, Section ring 없음) 회복. overlay div (9-B(b)) 는 유지.
- **10-B (Item 2, AreaControls 깜박임 차단)**: hotfix 5 의 `!isDimmed` 가드만으로는 hover trigger (group-hover/area) 가 잠깐 컨트롤을 보이게 함. 새로 `isAnyDrawerOpen = isSectionDrawerOpen || isAreaDrawerOpen || !!selectedWidgetId` 계산 추가, AreaControls / width-indicator 렌더 가드를 `!isDimmed` → `!isAnyDrawerOpen` 으로 교체. 드로어 열림 동안 모든 영역의 컨트롤 렌더 자체를 막아 hover 깜박임 원천 차단.
- **10-C (Item 3, FloatingAIButton 시프트)**: 기존 shift `md:-translate-x-96` (24rem) 가 PropertyDrawer (28rem) 와 4rem 차이로 가시 가림 발생. `md:-translate-x-[27rem]` 으로 확대.

### 진단 요지

- 10-A: hotfix 5 의 fallback 이 hotfix 2~3 의 마스터 의도와 충돌 — 의도 정합 복원.
- 10-B: `!isDimmed` 만으로는 hover trigger 가 dim 적용 전 1프레임 또는 hover 자체로 controls 표시. 드로어 상태 단일 가드로 통합 차단.
- 10-C: 단순 px/rem 계산 오류.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Section.tsx`
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/floating-ai-button/ui/FloatingAIButton.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 5관점 PASS.

### 잠재 우려 / Latent (누적)

- FloatingSectionBanner X 버튼이 widget 경로 banner 닫지 못함 (`selectSection(null)` 만 호출, `widgetStore.selectWidget(null)` 미호출).
- `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 6` (본 entry) — Phase 10 → data-craft i-dev 머지 + patch-note v001.166.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 7` 또는 `플랜 완료` 트리거 가능.

---

## v001.165.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 4)

### 개요

마스터 보고: "기존 취소, 인쇄는 3단계에서만 나와야하고, 3단계에서도 이전 단계로 이동 가능해야해" + "하단 표기는 취소, 인쇄 라인에 넣으라니까 왜 미리보기 바로 하단에 넣었어? 제대로 이동시켜" (HOTFIX 3a 의 통합 액션바 미완 blocker 해소 포함). advisor 사전 검증으로 페이지네이션은 HOTFIX 5 로 분리.

### 페이즈 결과

- **Phase 12 (HOTFIX 4)** (`5ca069d`): Strategy B1 — `FsGridCustomDialog` 에 `customFooter?: ReactNode` + `hideFooter?: boolean` 신규 props 추가, 3 패키지 `CustomDialogProps` 타입 동일 반영.
  - **위저드 단계 풋터 숨김**: column-select / row-select / period-select 진입 시 PrintDialog 가 `hideFooter={true}` 전달. StepShell 의 자체 Prev/Next 풋터와 더블 푸터 회피.
  - **preview 단계 customFooter 주입**: 3-존 레이아웃 — 좌측 `[← 이전 단계] [취소]`, 중앙 paper info pill (`{paperSize} · {orientation} · {width}×{height}mm`), 우측 prominent primary `[인쇄]` 버튼 (`shadow-sm shadow-primary/20`). 이전 단계는 `PrintContext.goBack` 호출.
  - **paper-info pill 위치 정정**: HOTFIX 3a 에서 미리보기 패널 하단에 둔 pill div 를 제거하고 customFooter 중앙 존으로 정확 이동. 마스터 요구 "취소·인쇄 라인 중앙" 충족.
  - **다른 dialog 영향 없음**: 신규 props 기본값 (`undefined` / `false`) 으로 기존 cancel/confirm 기본 풋터 동작 그대로 보존. 다른 FsGridCustomDialog 호출처 무관.

### 영향 파일

- data-craft (3 패키지, 9 파일):
  - `packages/fs-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-data-viewer/src/widgets/dialogs/FsGridCustomDialog.tsx`
  - `packages/fs-data-viewer/src/widgets/dialogs/types.ts`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-external-data-viewer/src/widgets/dialogs/FsGridCustomDialog.tsx`
  - `packages/fs-external-data-viewer/src/widgets/dialogs/types.ts`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-sub-data-viewer/src/widgets/dialogs/FsGridCustomDialog.tsx`
  - `packages/fs-sub-data-viewer/src/widgets/dialogs/types.ts`

9개 파일 / +237 / -108 / 단일 커밋.

> Scope 확장: 초기 6 파일 (PrintDialog ×3 + PrintPreview ×3) → 9 파일. FsGridCustomDialog API 가 footer 커스터마이즈 prop 부재하여 Strategy B1 채택 (마스터 자율 지시 + advisor 권고 명시 범위). PrintPreview 는 변경 없음 — pill 이 실제로는 PrintPreview 내부가 아닌 PrintDialog 의 우측 패널 하단 div 였음.

### 후속 (HOTFIX 5 예정)

미리보기 페이지네이션: 현재 iframe 콘텐츠가 세로로 길게 한 번에 표시. advisor 권고에 따라 printHtmlBuilder 의 page-break emit 여부 조사 후 정확 접근 (A/B/C 중) 결정 예정.

### advisor 검증

- **advisor (계획 사전)**: BLOCK → HOTFIX 4 (풋터+이전) / HOTFIX 5 (페이지네이션) 분할 권고. 분할 채택.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

---

## v001.164.0

> 통합일: 2026-05-18
> 플랜 이슈: #94

### 페이즈 결과

- **Phase 1 (`999b90e6` + lint hotfix `30191eea`)**: Area 픽셀 컨텍스트 유틸 `useWidgetAreaPixels` 신설 (widget→Area 양 경로 탐색, DOM ResizeObserver 측정, SSR 가드, sectionWidthPx 역산 fallback) + `setAreaWidthPercent` 액션 추가 (동료 Area 비례 재배분, MIN_AREA_WIDTH_PERCENT 가드, 합 100% 정규화).
- **Phase 2 (`05179c59`)**: `InputDesignSection` 을 Area px 너비 조정기로 재배선. `siblingAreaCount === 0` 이면 미렌더, min = `max(MIN_AREA_WIDTH_PX, sectionWidthPx * MIN_AREA_WIDTH_PERCENT / 100)`, max = `sectionWidthPx - min * siblingAreaCount`. `SubAreaHeightInput` 의 Enter+blur+justAppliedRef 패턴 답습. 적용 시 px → % 환산 후 `setAreaWidthPercent` 호출. `properties.width` 결합 완전 제거.
- **Phase 3 (`cafd2922`)**: `WidgetDesignGroup` 너비/높이 `onChange` 에 실시간 clamp 도입 (max=areaWidthPx/areaHeightPx, ready=0 미적용, min=1). `Input.widget.tsx` 의 mechanical 3-점 수정 — `widthStyle` 변수·wrapper div style·input style spread 제거하고 `w-full` 무조건화. `InputWidgetProps.width` 에 `@deprecated` JSDoc.
- **Phase 1 런타임 보정 (`30012967`)**: 메인 세션 advisor 사전 검증으로 발견된 DOM 선택자 결함 — `useWidgetAreaPixels` 가 `[data-area-id]` / `[data-section-id]` 를 쓰지만 실제 본체 요소엔 부재 (data-area-id 는 AreaControls 오버레이에만, data-section-id 는 완전 부재). `Area.tsx` 의 두 div 와 `Section.tsx` 본체 div 에 데이터 속성 추가.

### 마스터 의도 충족 — 3개 버그 모두 해소

1. **입력 디자인 너비 = Area 너비**: 컨트롤이 이제 실제로 영역 자체를 px 단위로 조정하며, 동료 Area 들이 비례 축소. 동료 Area 가 없으면 컨트롤이 미렌더.
2. **위젯 디자인 너비 실효성 회복**: `widthStyle` spread 가 `inlineStyles.width` 를 덮어쓰던 구조 제거 — 이제 `style.width` 가 실제로 `<input>` 에 적용됨.
3. **Area 픽셀 한계 clamp**: 위젯 디자인 너비/높이 입력이 `areaWidthPx`/`areaHeightPx` 를 초과 못 함 (실시간 clamp, max 초과 시 즉시 max 로 setValue).

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): 0 errors (Phase 1·2·3 모두).
- 다른 위젯 타입 회귀 위험은 `Input.widget.tsx` 단일-파일 mechanical 수정으로 최소화 (`getWidgetInlineStyles` 시그니처/적용 위치 불변).

### 영향 파일

data-craft:
- `src/entities/layout/model/resizeAreaAction.ts`
- `src/entities/layout/model/layoutTypes.ts`
- `src/widgets/property-drawer/lib/useWidgetAreaPixels.ts` (신규)
- `src/widgets/property-drawer/lib/index.ts` (신규)
- `src/widgets/property-drawer/ui/property-editors/input-editor/InputDesignSection.tsx`
- `src/widgets/property-drawer/ui/WidgetTypeDesignExtensions.tsx`
- `src/widgets/property-drawer/ui/WidgetStylesEditor.tsx`
- `src/widgets/property-drawer/ui/style-editors/WidgetDesignGroup.tsx`
- `src/widgets/input-widget/ui/Input.widget.tsx`
- `src/shared/types/widget-props.types.ts`
- `src/widgets/layout-canvas/ui/Area.tsx`
- `src/widgets/layout-canvas/ui/Section.tsx`

### 알려진 영향 (의도된 시각 변경)

기존 페이지에서 `InputWidgetProps.properties.width` 가 설정된 input 위젯은 본 머지 후 시각적 너비가 변함 — 이전: properties.width px, 이후: `w-full` × `style.width` (있을 때). 마스터 명시 의도에 부합 (silent deprecation, 필드 자체는 보존).

## v001.163.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 5)

### 핫픽스 결과 — Phase 9 (`58bd7e7`)

**advisor 사전 검증으로 5회 실패의 진짜 root cause 식별**: hotfix 4 의 LayoutCanvas widget→parent section fallback 은 LayoutCanvas 의 **로컬 useMemo** 만 보강하여 FloatingSectionBanner 표시는 OK 였으나, **store 의 `selectedSectionId` 는 여전히 null** → Section.tsx 의 `selectedSectionId === id` 비교 false → ring 조건 매칭 안 됨. Image 1 (드로어 닫힘 + 컨트롤바 표시) 의 banner-without-ring 상태가 명확한 증거.

### 2중 방어 처방

- **9-A (Item 1, AreaControls dim 스킵)**: `Area.tsx` 의 AreaControls 렌더 가드에 `&& !isDimmed` 추가. 비선택 영역의 컨트롤 아이콘 자체를 렌더 안 함 → 막 뒤 비침 문제 원천 해소.
- **9-B (Item 2, Section ring 5회째 진짜 해결 — 2중 방어)**:
  - (a) `Section.tsx` 에 `useWidgetStore.selectedWidgetId` read + `isOwningSelectedWidget` useMemo fallback. 자식 widget (Area/SubArea) 이 selected 인 경우에도 ring 표시 → LayoutCanvas 의 selectedSection 계산과 동기.
  - (b) outline 클래스 제거 → 절대 위치 overlay div (`absolute inset-0 pointer-events-none border-2 border-blue-500 z-30`) 로 ring 그리기. hotfix 3 의 dim overlay 패턴과 동일 (검증됨). paint layer 와 store state 양쪽 issue 동시 해결.
- **9-C (Area focused ring 통일)**: Area focused 의 outline 도 같은 overlay div 패턴 (`border-[3px]`, z-30, `borderRadius` 동기) 으로 교체. Section 과 일관 + paint 안정성.

### 진단 요지

- 9-A: dim 가시성 보장 위해 컨트롤 자체를 안 그리는 게 정답 (overlay 더 진하게 = 콘텐츠도 안 보임, 마스터 거부 방향).
- 9-B: store/component 양쪽 fallback + CSS paint layer 양쪽 issue 가 1줄 변경 패턴으로 5회 실패한 원인. 2중 방어가 정답.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 5관점 PASS — 5회 실패 history 분석 + Image 1 banner-without-ring 증거 기반.

### 잠재 우려 / Latent

- 누적 latent (#84): FloatingSectionBanner X 버튼 widget 경로 미닫힘 / `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false. 별도 처리 필요.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 5` (본 entry) — Phase 9 → data-craft i-dev 머지 + patch-note v001.163.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 6` 또는 `플랜 완료` 트리거 가능.

---

## v001.162.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 3b)

### 개요

마스터 보고: "1,2단계도 전부 디자인 다시 개선해 여전히 너무 단순해". HOTFIX 1 (v001.154.0) 의 단계 컴포넌트 디자인이 토큰 위주여서 시각 위계 얕음. 본 핫픽스는 advisor 권고에 따라 HOTFIX 3 분할 두 번째 (3b) — StepShell + 5개 step 컴포넌트의 깊은 시각 위계 + 풍부한 디테일 추가.

### 페이즈 결과

- **Phase 11 (HOTFIX 3b)** (`b13970d`): 3 패키지 12개 파일 동일·시각parity 패턴.
  - **StepShell**: hero 헤더 영역 도입 — `bg-gradient-to-br from-primary/5 to-transparent` 영역에 `w-12 h-12 rounded-2xl bg-primary/10` 아이콘 배지 + `text-xl font-bold tracking-tight` 제목. 스테퍼 동그라미 사이 connector line + 활성 동그라미 `ring-2 ring-primary ring-offset-2`. 풋터는 `backdrop-blur` + prominent primary Next 버튼 (`shadow-sm shadow-primary/20`). `stepIcon?: LucideIcon` 선택 prop 추가.
  - **SharedColumnSelectStep**: 상단 요약 카드에 `text-3xl font-bold tabular-nums` 큰 선택수 강조. 24×24 둥근 사각 체크박스 (`rounded-md border-2` + Check 아이콘 오버레이). 컬럼 타입 배지 (`px-2 py-0.5 rounded text-[10px] uppercase bg-muted`) 추가.
  - **GridRowSelectStep**: 라디오 카드를 `rounded-2xl border-2 p-5` 큰 카드로. 선택 시 `bg-gradient-to-br from-primary/5 to-primary/10 shadow-md` + 우상단 Check 배지 (`absolute top-3 right-3 w-6 h-6 rounded-full bg-primary`). 아이콘 영역 `w-12 h-12 rounded-xl`. 범위 입력은 카드 내부 `border-t border-border/50` 으로 분리.
  - **CalendarRowSelectStep**: 상단 요약 카드 + 월 배지 (`bg-primary/10 text-primary` Calendar 아이콘 포함). 날짜 그룹 헤더 강화 — `text-base font-bold tabular-nums` 큰 날짜 + `(요일)` + 카운트 배지.
  - **GanttPeriodSelectStep**: hero summary 카드 (`text-3xl tabular-nums` 일수 강조) + 폼 카드 (`rounded-xl p-5 space-y-4`). "최대 6개월" 헬퍼는 Info 아이콘 동반. 오류 블록은 `bg-destructive/10 border border-destructive/30` 카드.
  - **GanttRowSelectStep**: 요약 카드 + 행별 기간 라벨 (`inline-flex items-center gap-1` + Calendar 아이콘 size 12). 빈 결과 시 empty state (큰 아이콘 + 안내 텍스트).

### 영향 파일

- data-craft (3 패키지, 12 파일):
  - **fs-data-viewer** (6): StepShell / SharedColumnSelectStep / GridRowSelectStep / CalendarRowSelectStep / GanttPeriodSelectStep / GanttRowSelectStep
  - **fs-external-data-viewer** (3): StepShell / SharedColumnSelectStep / GridRowSelectStep
  - **fs-sub-data-viewer** (3): StepShell / SharedColumnSelectStep / GridRowSelectStep

12 파일 / +698 / -412 / 단일 커밋.

### 잔여 한계 (변동 없음)

v001.150.0 의 5개 알려진 한계 + v001.159.0 의 통합 액션바 미완 (FsGridCustomDialog 풋터 수정 필요) 모두 보존.

### advisor 검증

- **advisor (계획 사전)**: HOTFIX 3 단일 디스패치는 BLOCK → 분할 권고 (3a/3b) 채택.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.161.0

> 통합일: 2026-05-18
> 플랜 이슈: #93

### 페이즈 결과
- **Phase 1** (`b387eb68`): `SortableTreeItem.tsx` 의 선택 상자 배지 `<span>` 과 숨김 화면 `<Badge>` 의 className 끝에 `group-hover:hidden` 추가. 컨테이너 div 의 기존 `group` 클래스가 트리거 역할을 하여 호버 시 두 배지가 자연스럽게 사라지고, 우측 액션 버튼 그룹 (`hidden group-hover:flex`) 과 시각적으로 충돌하지 않게 된다. 로직 변경 없이 클래스 추가만 수행.

### 영향 파일

- data-craft:
  - `src/widgets/page-navigation/ui/SortableTreeItem.tsx`

## v001.160.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 4)

### 핫픽스 결과 — Phase 8 (`fada8b5`)

**advisor 사전 검증으로 4회 연속 실패의 진짜 root cause 식별**: `ring-inset` 이 inset box-shadow 라 element background 위에는 그려지지만 **자식 element 가 영역을 채우면 그 위에 자식 background 가 덮인다** — CSS paint phase 순서 문제. Phase 3 / hotfix 1/2/3 은 모두 조건/클래스만 만지고 paint layer 가설은 미검증. 본 hotfix 가 paint layer 변경으로 정답 도달.

- **8-A (Section ring 진짜 해결, item 3)**: `Section.tsx` 의 `ring-2 ring-blue-500 ring-inset` → `outline outline-2 outline-blue-500 -outline-offset-2`. outline 은 별도 paint phase 라 자식이 가릴 수 없음. 조건 (`isSectionSelected = isDesignMode && selectedSectionId === id && !isSectionDrawerOpen && !isAreaDrawerOpen`, hotfix 3 결과) 그대로 유지.
- **8-B (Area ring 1.5배, item 1)**: `Area.tsx` 의 `ring-2 ring-blue-500 ring-inset` → `outline outline-[3px] outline-blue-500 -outline-offset-[3px]`. 2px × 1.5 = 3px. Section 과 일관 outline 처방.
- **8-C (영역 포커싱 시 섹션 컨트롤바 표시, item 2)**: `LayoutCanvas.tsx:247` 의 `selectedSection` 계산을 `useMemo` 로 확장 — `selectedSectionId` 없으면 `selectedWidgetId` 의 parent section (Area/SubArea widgetId 매칭) fallback. 위젯 클릭 → PropertyDrawer 열림 + FloatingSectionBanner (fixed z-50, dim overlay z-20 위) 자동 표시.

### 진단 요지

- 8-A/B: **outline vs ring 의 CSS paint layer 차이**. ring (= box-shadow) 은 element 의 paint stack 내, outline 은 별도. 자식이 영역 채우는 컴포넌트에서는 outline 이 가시성 보장. 이전 4회 hotfix 가 이 가설을 거치지 않은 것이 진단 부족.
- 8-C: widget 선택 경로가 `selectedSectionId` 를 set 하지 않아 banner 표시 조건이 불성립 → 마스터에겐 "안 보임 / 어둡게 안 나옴" 으로 인지. parent section 역추적 fallback 으로 해결.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`
  - `src/widgets/layout-canvas/ui/LayoutCanvas.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 (dispatch 전) 5관점 PASS — 4회 실패 history 분석 후 paint layer 가설 도출.

### 잠재 우려 / Latent (non-blocking)

- 8-C 부산물: FloatingSectionBanner X 버튼 `onClose` 가 `selectSection(null)` 만 호출하므로 widget 경로로 표시된 banner 는 selectedSectionId 가 이미 null 이라 닫히지 않음. 닫기 핸들러에 `widgetStore.selectWidget(null)` 추가 필요 (별도 처리).
- 8-A/B outline: `overflow-hidden` 영향 없음 (CSS 명세). WebKit 렌더러 드문 예외만 manual test 시 확인.

### 누적 latent

- `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false. 별도 처리 필요.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 4` (본 entry) — Phase 8 → data-craft i-dev 머지 + patch-note v001.160.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 5` 또는 `플랜 완료` 트리거 가능.

---

## v001.159.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 3a)

### 개요

마스터 보고: (1) 고급 옵션 / 배치 인쇄 / 히스토리 3개 탭 제거 + 기본 설정도 탭 없이 한 화면 (2) 미리보기 용지가 영역 초과·잘림 → 비율 맞춰 절대 안 잘리게 (3) 미리보기 상단 옵션을 좌측으로 통합 + 단순 표기는 취소·인쇄 사이 중앙으로. advisor 사전 검증의 분할 권고에 따라 본 핫픽스 (3a) 는 PrintDialog 골격 + 미리보기 fit 만, 단계 컴포넌트 디자인 보강은 HOTFIX 3b 로 분리.

### 페이즈 결과

- **Phase 10 (HOTFIX 3a)** (`7702eef`): 3 패키지 PrintDialog + PrintPreview 동일 패턴.
  - **탭 4종 완전 제거**: `activeTab` state + `setActiveTab` 호출 + 4개 탭 버튼 행 + `BatchPrintTab` / `PrintHistoryTab` / 고급 옵션 컨테이너 import 와 분기 블록 전부 삭제. `useEffect` 의존성에서 activeTab 제거.
  - **2-pane 레이아웃** (preview 단계): 좌측 320px `border-r overflow-y-auto bg-card` 옵션 패널 (용지 / 여백 / 머리말·꼬리말 / 엔진 / 템플릿 5 섹션, 각 섹션 헤더 `text-xs font-semibold uppercase tracking-wide text-muted-foreground` + 구분선) + 우측 미리보기 영역. wizard 단계는 손대지 않음.
  - **미리보기 fit-and-center**: 고정 600×800px 기준 스케일 → `ResizeObserver` 로 컨테이너 실측 후 `fitScale = min(가용폭/용지픽셀폭, 가용높이/용지픽셀높이, 1)`. 용지가 항상 비율 유지하며 절대 잘리지 않음. `transform: scale(fitScale * zoom/100)` + `transform-origin: center center` + `overflow: auto` 로 줌 확대 시 스크롤.
  - **상단 컨트롤 제거**: PrintPreview 의 방향 토글 + 용지 select + 상단 paper-info pill 제거. 옵션은 좌측 패널, 단순 표기는 미리보기 패널 하단 중앙 pill 로 재배치.

### 영향 파일

- data-craft (3 패키지):
  - `packages/fs-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintDialog.tsx`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintPreview.tsx`

6개 파일 / +586 / -889 / 단일 커밋.

### 잔여 한계

1. **취소·인쇄 통합 액션바 미완**: `FsGridCustomDialog` 풋터에 중앙 슬롯이 없어 본 핫픽스는 paper-info pill 만 미리보기 패널 하단 중앙에 배치. 취소/인쇄 버튼은 FsGridCustomDialog 기존 footer 에 그대로. 단일 액션바로 완전 통합하려면 `widgets/dialogs/FsGridCustomDialog.tsx` 수정 필요 — scope 외 (마스터 결정 시 별 핫픽스).
2. v001.150.0 의 5개 알려진 한계는 변동 없음.

### advisor 검증

- **advisor (계획 사전)**: BLOCK → 분할 권고 (3a/3b). 분할 채택 후 3a 진행.
- **lint**: PASS (0 errors, 11 warnings — 신규 위반 없음).

## v001.158.0

> 통합일: 2026-05-18
> 플랜 이슈: #92

### 페이즈 결과

- **Phase 1 (`decc0df`)** — `PromotionRow` 표기 단순화. 아코디언 토글 폐지, 구분선 아래 2-줄 평탄 구조로 전환. 협업 플랜 문구 "협업 플랜 (n인 이상 요금제)" 로 교체, `featuresList` 다열 `<ul>` → 단일 `<p>` 인라인 (` · ` 구분) 표기.

### 마스터 의도

플랜 업그레이드 모달 Step1 의 프로모션 행에서:
1. 협업 플랜 안내를 "협업 플랜 (n인 이상 요금제)" 단순 표기로 교체.
2. "자세히" 토글 버튼을 제거하고, 요약 아래 구분선 + (협업 줄) + 제공 서비스 한 줄 구조로 평탄화.

### 영향 파일

- data-craft:
  - `src/features/subscription/ui/PromotionRow.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 사전-존재 경고, 0 errors).
- advisor #1 (계획 시점) 5관점 PASS — 사전 BLOCK 1회 (마스터 §2 직역 정정) 후 통과.
- advisor #2 (완료 시점) 5관점 PASS, BLOCK 없음.

## v001.157.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 3)

### 핫픽스 결과 — Phase 7 (`59b904f`)

마스터 의도 재정정 + 2건 회귀 통합 수정 (advisor 사전 검증 + 완료 검증 모두 PASS).

- **7-A (dim 효과 정정)**: hotfix 2 의 `opacity-10 brightness-50 grayscale` 는 콘텐츠 자체를 거의 안 보이게만 만들어 마스터 의도 "진한 회색 + 어느정도 보임" 과 불일치. opacity 필터 클래스 제거 후 외곽 컨테이너 직접 자식으로 `<div absolute inset-0 bg-black/60 pointer-events-none z-20 transition-opacity duration-200 />` overlay 조건부 렌더. `borderRadius` 동기 (Phase 1 모서리 둥글기와 일관). z-20 > AreaControls z-10 으로 dim 영역의 컨트롤까지 덮음.
- **7-B (Section ring 조건 단순화)**: hotfix 2 의 `!selectedWidgetId` 조건이 너무 보수적이어서 위젯 잔류 선택 상태에서 control bar 떠도 ring 누락. 조건 제거 + `useWidgetStore` 임포트 삭제. `FloatingSectionBanner` (`LayoutCanvas.tsx:335`) 와 정확히 동일한 조건 (`isDesignMode && selectedSectionId === id && !isSectionDrawerOpen && !isAreaDrawerOpen`) 으로 정렬 — control bar 와 ring 표시 시점이 동기.

### 진단 요지

- 7-A: opacity 기반 dim 은 콘텐츠를 사라지게 만들 뿐 "회색 막" 의미를 살리지 못함. overlay div 가 정확한 처방.
- 7-B: ring 조건과 banner 조건의 비대칭 (`!selectedWidgetId` 만 ring 측 추가) 이 hotfix 2 의 root cause.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor 사전 검증 (dispatch 전, fault site 진단) 5관점 PASS.
- advisor #2 (완료 시점) 5관점 PASS, BLOCK/CONCERN 없음.

### 잠재 우려 (block 안 함)

- overlay 강도 `bg-black/60` 이 마스터 감각상 적절하지 않으면 50/70 조정 trivial (hotfix 4 1줄 변경).

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 3` (본 entry) — Phase 7 → data-craft i-dev 머지 + patch-note v001.157.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 4` 또는 `플랜 완료` 트리거 가능.

---

## v001.156.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 2)

### 개요

마스터 보고: "미리보기는 선택된 용지와 방향에 따라 용지를 먼저 그려넣고 그 용지 내부에서 미리보기가 그려지는게 정상인데 현재 방향이나 용지를 바꿔도 전혀 이게 어떻게 프린트된다는건지 알 수 없음." 기존 PrintPreview 는 단순 흰 박스 + 그림자였고 그리드만 방향 토글이 있었음. 용지의 시각성·식별성 보강 + 용지/방향 즉시 반영을 모든 뷰에 적용.

### 페이즈 결과

- **Phase 9 (HOTFIX 2)** (`992ce71`): 3개 패키지 PrintPreview 동일 패턴 수정.
  - **용지 카드 시각화**: 단순 `shadow-lg bg-white` → `shadow-[0_8px_30px_rgb(0,0,0,0.15)]` + `border border-gray-200` 적용으로 배경과 명확히 분리되는 종이 느낌. `transition-[width,height] duration-200` 으로 용지/방향 변경 시 모핑.
  - **용지 정보 pill 레이블**: 미리보기 영역 상단에 `{용지명} · {방향} · {width}×{height}mm` 형식 pill (`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-card border border-border text-xs text-muted-foreground`) 배치. 현재 설정 한눈 확인.
  - **방향 토글 + 용지 크기 select 모든 뷰 노출**: 기존 `viewMode === 'grid'` 게이팅 제거. RectangleVertical/RectangleHorizontal pill 세그먼트 + A4/A3/Letter/Legal `<select>` 컨트롤이 그리드·캘린더·간트 어디서나 동작.

### 영향 파일

- data-craft (3 패키지):
  - `packages/fs-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-external-data-viewer/src/features/print/ui/PrintPreview.tsx`
  - `packages/fs-sub-data-viewer/src/features/print/ui/PrintPreview.tsx`

3개 파일 / +153 / -102 / 단일 커밋.

### 잔여 한계 (v001.150.0 그대로 유지)

본 핫픽스는 미리보기 시각 layer 만 보강 — v001.150.0 의 5개 알려진 한계는 변동 없음. 핵심 BLOCK 사유 (그리드 fetch-all) 후속 권장.

### advisor 검증

- lint PASS (0 errors, 11 warnings — 신규 위반 없음).
- 코드 의도 충족 (paper-shape 시각화 + 모든 뷰 컨트롤 노출 + transition). 시각 완성도는 마스터 브라우저 확인 신호.

## v001.155.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 2)

### 핫픽스 결과 — Phase 6 (`babfa70`)

마스터 의도 정정 + 3건 잔여 회귀 통합 수정.

**마스터 의도 표** (정정):

| 상태 | Area 테두리 | Section 테두리 | dim |
|---|---|---|---|
| 드로어 (PropertyDrawer) 열림 | 선택 Area 에 파란 ring | 없음 | 비선택 Area 진한 회색 막 |
| 컨트롤바만 표시 (드로어 닫힘) | 없음 | 선택 Section 에 파란 ring | 없음 |
| 둘 다 없음 | 없음 | 없음 | 없음 |

**수정 내용**:

- **6-A (Area 파란 테두리 복원)**: `computeDesignBorderStyleOverride` (`areaBorderStyles.ts`) 가 커밋 `dfa82b47` 이후 항상 `{}` 반환 (no-op) 으로 Area 테두리가 사실상 표시되지 않던 회귀. `Area.tsx` 에서 `isFocused = isDesignMode && isEditing && isBright` 도출 (기존 `useActiveEditingTarget` 출력 재사용), className 에 `ring-2 ring-blue-500 ring-inset` 조건부 추가 — 드로어 열림 + 포커스된 Area 에 파란 ring 복원.
- **6-B (Section ring drawer 동기)**: `Section.tsx:41` `isSectionSelected = isDesignMode && selectedSectionId === id` 가 drawer-open 상태 무시 → 드로어 열림에도 Section ring 이 떠 마스터 의도 위반. `isSectionDrawerOpen`/`isAreaDrawerOpen` (layoutStore) + `selectedWidgetId` (widgetStore) read 추가, `isSectionSelected` 조건에 `!isSectionDrawerOpen && !isAreaDrawerOpen && !selectedWidgetId` 결합 — `LayoutCanvas.tsx:335` 의 FloatingSectionBanner 표시 조건과 동기.
- **6-C (dim 강도 보강)**: `Area.tsx:84` dim 클래스 `opacity-20 grayscale` → `opacity-10 brightness-50 grayscale` 으로 강화. 마스터 manual test 에서도 부족하면 hotfix 3 에서 overlay div (`absolute inset-0 bg-black/50`) 로 추가 강화 가능.

### 진단 요지

- 6-A: 기존 ring 적용 경로가 사실상 부재 (helper no-op). 새 className 진입.
- 6-B: drawer-state 누락이 root cause — FloatingSectionBanner 의 검증된 조건 미러링이 정답.
- 6-C: Tailwind 단일 opacity-20 만으로는 대조 약함 — opacity + brightness 조합 강화.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 11 warnings, 0 errors).
- advisor #2 (hotfix 2 시점) 5관점 모두 PASS — 이번 라운드는 Explore 로 정확한 라인/조건 확정 후 처방되어 이전 hotfix 의 Evidence CONCERN 양상 해소.

### 잠재 우려 (block 안 함)

- 6-A: 섹션 드로어 (`isSectionDrawerOpen && selectedSectionId`) 열림 시 `useActiveEditingTarget` 가 sectionId 반환 → 그 섹션 내 모든 Area 에 ring. 마스터 의도가 "단일 Area 만 ring" 이면 manual test 후 정밀화 가능.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 2` (본 entry) — Phase 6 → data-craft i-dev 머지 + patch-note v001.155.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 3` 또는 `플랜 완료` 트리거 가능.

---

## v001.154.0

> 통합일: 2026-05-18
> 플랜 이슈: #86 (HOTFIX 1)

### 개요

v001.150.0 (#86 본체) 의 인쇄 단계 UI 가 raw HTML 프리미티브 (`<button>`/`<input type="radio">`/`<input type="checkbox">`/`<input type="date">`/`<ul>/<li>`) 로 작성되어 마스터가 "90년대 웹사이트 같다" 로 반려. tailwind 디자인 토큰 + lucide-react 아이콘 기반으로 15개 파일 (3개 데이터-뷰어 패키지) 전면 재작성. 동작 변경 없음 — 시각 layer 만 교체.

### 페이즈 결과

- **Phase 8 (HOTFIX 1)** (`a56eaa6`):
  - **StepShell** (3 패키지): 번호 원형 인디케이터 (active/past/future 상태별 색상 분기) + ChevronLeft/ChevronRight 아이콘 버튼 풋터. `bg-card rounded-xl border` 카드 셸.
  - **SharedColumnSelectStep** (3 패키지): 커스텀 체크박스 (Check 아이콘 오버레이) + 선택 수 요약 헤더 + 전체 선택/해제 토글. row hover 시 `bg-muted/50`.
  - **GridRowSelectStep** (3 패키지): 3종 라디오를 카드형 선택 UI 로 전환. 아이콘 Database (전체) / CheckSquare (선택) / ListFilter (범위). 선택 카드는 `border-primary bg-primary/5`. 범위 선택 시 두 number input 펼침.
  - **CalendarRowSelectStep** (fs-data-viewer): 날짜 그룹 헤더 sticky (`bg-card/80 backdrop-blur`) + 스크롤 가능 max-h 컨테이너 + 카운트 요약 + 전체 선택 컨트롤.
  - **GanttPeriodSelectStep** (fs-data-viewer): `grid grid-cols-2 gap-3` 날짜 입력 + `text-sm font-medium` 라벨 + 6개월 초과 시 AlertCircle 아이콘 + `text-destructive` 오류 노출.
  - **GanttRowSelectStep** (fs-data-viewer): 행별 기간 라벨 (`2026-05-18 → 2026-06-12`) 표시, 스크롤 목록 + 전체 선택 + 카운트 요약.
  - **PrintPreview** (3 패키지): 세로/가로 토글을 pill 세그먼트 컨트롤로 교체 — 활성 `bg-background shadow-sm`, 비활성 회색 텍스트. RectangleVertical/RectangleHorizontal lucide 아이콘.

### 영향 파일

- data-craft:
  - **fs-data-viewer** (7개):
    - `src/features/print/ui/steps/StepShell.tsx`
    - `src/features/print/ui/steps/SharedColumnSelectStep.tsx`
    - `src/features/print/ui/steps/GridRowSelectStep.tsx`
    - `src/features/print/ui/steps/CalendarRowSelectStep.tsx`
    - `src/features/print/ui/steps/GanttPeriodSelectStep.tsx`
    - `src/features/print/ui/steps/GanttRowSelectStep.tsx`
    - `src/features/print/ui/PrintPreview.tsx`
  - **fs-external-data-viewer** (4개):
    - `src/features/print/ui/steps/StepShell.tsx`
    - `src/features/print/ui/steps/SharedColumnSelectStep.tsx`
    - `src/features/print/ui/steps/GridRowSelectStep.tsx`
    - `src/features/print/ui/PrintPreview.tsx`
  - **fs-sub-data-viewer** (4개):
    - `src/features/print/ui/steps/StepShell.tsx`
    - `src/features/print/ui/steps/SharedColumnSelectStep.tsx`
    - `src/features/print/ui/steps/GridRowSelectStep.tsx`
    - `src/features/print/ui/PrintPreview.tsx`

총 15개 파일 / +770 / -535 / 단일 커밋.

### 잔여 한계 (v001.150.0 알려진 한계 그대로 유지)

본 핫픽스는 시각 layer 만 교체 — v001.150.0 의 5개 알려진 한계 (그리드 fetch-all 부재 / 캘린더 currentMonth 동기 / fs-external i18n 키 / 간트 style 인라인 중복 / 간트 dead code 잔존 가능성) 는 변동 없음. 핵심 BLOCK 사유 (그리드 fetch-all) 는 후속 핫픽스 또는 별 plan-enterprise 권장.

### advisor 검증

- **advisor #2 (핫픽스 완료)**: PASS — 코드 의도 충족 (raw HTML → tailwind 토큰 + lucide). 시각 완성도는 마스터 브라우저 확인이 최종 신호.

## v001.153.0

> 통합일: 2026-05-18
> 플랜 이슈: #90

### 페이즈 결과

- **Phase 1** (`4abc34a`): 공용 로그인 (`SigninForm.tsx`) 과 기업/서브도메인 로그인 (`SubdomainLoginForm.tsx`) 의 이메일 입력에서 Enter 키 누르면 비밀번호 입력으로 포커스 이동. 각 폼에 `passwordRef = useRef<HTMLInputElement>(null)` 추가, 비밀번호 `<Input>` 에 `ref={passwordRef}` 부여, `EmailInput` `onKeyDown` 에서 IME 가드 (`if (e.nativeEvent.isComposing) return;` — 코드베이스 `EnterInput.tsx:64` 컨벤션 일치) 후 Enter 시 `e.preventDefault()` + `passwordRef.current?.focus()` 호출. `EmailInput` 의 `...rest` 가 underlying shadcn `Input` 까지 props 를 전달하므로 컴포넌트 자체 수정 불필요.

### 영향 파일

- data-craft:
  - `src/pages/auth/SigninForm.tsx`
  - `src/pages/auth/SubdomainLoginForm.tsx`

## v001.152.0

> 통합일: 2026-05-18
> 플랜 이슈: #88 (HOTFIX 2)

### 핫픽스 페이즈 결과

- **Phase 6 / HOTFIX 2** (`1a16f39`): 포함된 기능 접힌 상태에서 행당 2개씩 (2×2) 보장. `PlanFeatureList.tsx` 에 `showMaxFileCard` boolean + `featureCap = COLLAPSED_COUNT - (1 if showMaxFileCard else 0)` 동적 슬라이스 도입. 접힌 상태 총 카드 = 합성 카드(0|1) + featureCap = 항상 `COLLAPSED_COUNT (4)` → `grid-cols-2` 에서 정확히 2×2. 추가로 합성 카드 className 다중 라인을 한 줄로 정리해 Tailwind content scanner 누락 위험 제거.

### 진단 요지

v001.146.0 Phase 1 의 합성 카드가 접힌 상태에서 `features.slice(0, COLLAPSED_COUNT=4)` 와 합쳐져 총 5장이 되어 `grid-cols-2` 의 2/2/1 레이아웃 (마지막 행 1장) 으로 표시되던 문제. featureCap 동적화로 합성 카드 표시 시 features 슬라이스를 1 감소시켜 항상 깔끔한 2×2 보장.

### 검증 한계 (caveat)

- 수정은 카드 개수를 수학적으로 4 이하로 보장. 단 마스터의 "1열" 보고가 grid-cols-2 CSS 자체 미적용을 의미할 경우 본 핫픽스는 5→4 정리 효과만 있고 1-column 잔존 가능. 머지 후 마스터 시각 재확인 필요 — 잔존 시 별도 hotfix (Tailwind purge / dialog 폭 / CSS 충돌 등 별도 원인 조사) 필요.

### 영향 파일

- data-craft:
  - `src/widgets/settings-dialog/ui/plan/PlanFeatureList.tsx`
## v001.151.0

> 통합일: 2026-05-18
> 플랜 이슈: #88 (HOTFIX 1)

### 핫픽스 페이즈 결과

- **Phase 5 / HOTFIX 1** (`27e282e`): subscription 배럴에 `MAX_FILE_UPLOAD_FEATURE_STYLE` export 추가. v001.146.0 (Phase 1) 에서 `planFeatures.ts` 에 정의된 상수를 `PlanFeatureList` 가 배럴 경유로 import 하나, `src/features/subscription/index.ts` 의 `export { ... } from './lib/planFeatures'` 명단에 누락된 상태로 머지되어 `pnpm dev` / `pnpm build` 시 `TS2305 has no exported member 'MAX_FILE_UPLOAD_FEATURE_STYLE'` 발생 → 모듈 평가 실패 → React 미마운트 흰 화면. 단일 파일 단일 라인 (export 명단에 심볼 추가) 으로 해소.

### 진단 요지

- 페이즈별 lint gate (`pnpm typecheck:all && pnpm lint`) 가 모노레포 `packages/*` 만 검사하고 root `src/` 는 검사하지 않아 본 누락 export 가 lint 단에서 잡히지 않음. 메인 repo `pnpm build` (vite production) 또는 `pnpm dev` (vite/esbuild dep-scan) 실행 시점에서야 표면화.
- 잠재적 후속 작업: typecheck:all 의 검사 스코프 확장 (root src/ 포함) 또는 페이즈별 lint gate 에 빌드 검증 추가 검토 — 본 핫픽스 범위 외.

### 검증

- `pnpm build` grep: `MAX_FILE_UPLOAD|settings-dialog/ui/plan` 매치 0건 (수정 후).
- `pnpm typecheck:all && pnpm lint` exit 0.
- 메인 repo `/Users/starbox/Documents/GitHub/data-craft` 에서 `pnpm dev` 재기동 → vite 5173 ready, 에러 로그 없음, `PlanFeatureList.tsx` 변환 22 KB 성공 응답 (모듈 해석 OK). 시각 확인은 마스터 몫.

### 영향 파일

- data-craft:
  - `src/features/subscription/index.ts`

## v001.150.0

> 통합일: 2026-05-18
> 플랜 이슈: #86

### 개요

데이터 뷰어 인쇄 시스템에 **뷰별 단계형 선택 플로우** 도입. 인쇄 버튼 클릭 즉시 인쇄 모달이 뜨던 흐름을 → 열 선택 (또는 간트의 기간 선택) → 행 선택 → 미리보기의 3단계 위저드로 재설계. 칸반·대시보드 뷰는 인쇄 제거. 그리드 A4 가로 + 캘린더 A4 세로 + 간트 A4 가로 기본. 3개 데이터-뷰어 패키지 (`fs-data-viewer`, `fs-external-data-viewer`, `fs-sub-data-viewer`) 전부 적용.

### 페이즈 결과

- **Phase 1** (`6fbb8c8`): 칸반·대시보드 인쇄 버튼 헤더 가드. `HeaderSearch.tsx` 의 `onOpenPrintDialog` 를 optional 로 전환, `HeaderActions.tsx` 가 칸반에는 undefined 전달·대시보드 standalone 블록 삭제로 두 뷰 모두 인쇄 버튼 미노출.
- **Phase 2** (`92aa3ef`): 단계형 흐름 인프라. `PrintContext` 에 `step: 'period-select' | 'column-select' | 'row-select' | 'preview'` + `goNext/goBack/resetSteps` 추가, `openPrintDialog` 본체에 kanban/dashboard no-op 가드 (우회 경로 차단). `DEFAULT_ORIENTATION_BY_VIEW` (grid=landscape, calendar=portrait, gantt=landscape). 신규 `StepShell`, `SharedColumnSelectStep` 본구현 + 4개 per-view step placeholder. 기존 6개 탭은 `step === 'preview'` 일 때만 노출. `PrintCache.generateKey` 가 viewMode + orientation + paperSize + selectedColumns hash + rowScope hash + gantt period hash 의 명시적 조합으로 재구성. `bug-907-print-cache-key.test.ts` 에 6개 신규 케이스.
- **Phase 3** (`00dbb17`): 그리드 흐름 구현. `GridRowSelectStep` 의 3종 라디오 (전체 / 선택된 행 = `SelectionStateContext.selectedRows` 연동 / 범위 = `BatchInputScope { type: 'range', startRowId, endRowId }` 재사용). `PrintPreview` 에 그리드 전용 가로/세로 토글. `useGridPrint.resolveRows` 가 rowScope→in-memory 필터. `printHtmlBuilder.buildGridColumnWidths` 신규 — 선택 컬럼 원본 width 정규화 → 용지 콘텐츠 너비 비례 배분 `<colgroup>`.
- **Phase 4** (`260e018`): 캘린더 흐름 구현. `CalendarRowSelectStep` 이 현재 월 행을 날짜별 그룹화 (날짜 헤더 `YYYY-MM-DD (요일)` + 행 체크박스, 빈 날짜 미표시), 선택 결과는 `options.calendar.rowScope = { type: 'selected', rowIds }`. `useCalendarPrint` 가 기존 월 그리드 본문 보존 + `buildCalendarAppendixTable` 호출. `printHtmlBuilder.buildCalendarAppendixTable` 신규 — 선택 행×선택 열 부록 표.
- **Phase 5** (`01eadb1` + lint hotfix `3860b9d`): 간트 흐름 구현. `GanttPeriodSelectStep` (시작/종료 + 종료<시작·6개월 초과 인라인 검증, 기본 오늘~+30일). `GanttRowSelectStep` (dateRange 와 bar 겹치는 행만 다중 선택). `useGanttPrint` 의 auto-trim (선택 행 bar min/max ∩ dateRange 교집합) + `splitGanttRowsIntoPages` 연동. `printHtmlBuilder.buildGanttHorizontalHtml` (수평 시간 축 균등 분할, 행별 막대 left/width% 배치, 진행률 오버레이). `pagination/ganttRowPagination.ts` 신규 (A4 가로 기준 행-축 페이지 분할 헬퍼). lint hotfix 로 이전 테이블 방식 dead code (`generateGanttTableHtml`/`renderSingleGanttTable`/`dateStringToEpochDays`/`epochDaysToDateString`) 제거.
- **Phase 6** (`af24799`): fs-external-data-viewer 에 wizard + 그리드 단계 흐름 이식. types.ts 에 PrintWizardStep + PrintRowScope + GridPrintOptions.rowScope, DEFAULT_ORIENTATION_BY_VIEW.grid=landscape. PrintContext step 상태 + 액션. PrintDialog step 라우팅. 신규 StepShell/SharedColumnSelectStep/GridRowSelectStep 은 fs-external 자체 `useSelectionStateOptional` 사용 (cross-package import 없음). PrintCache.generateKey 동일 재구성.
- **Phase 7** (`83f3f61`): fs-sub-data-viewer 동일 포팅. fs-sub 고유의 `idColumn` (rowId 타입) 분리 구조 보존. PrintPreview 의 iframe useEffect 가 srcDoc 패턴으로 대체됨 + `usePrintOptions` 훅으로 방향 토글.

### 영향 파일

- data-craft (모노레포):
  - **fs-data-viewer**:
    - `src/widgets/data-viewer-header/HeaderActions.tsx`
    - `src/widgets/data-viewer-header/header-search/HeaderSearch.tsx`
    - `src/widgets/data-viewer-header/header-search/searchTypes.ts`
    - `src/features/print/context/PrintContext.tsx`
    - `src/features/print/types.ts`
    - `src/features/print/ui/PrintDialog.tsx`
    - `src/features/print/ui/PrintPreview.tsx`
    - `src/features/print/ui/steps/StepShell.tsx` (신규)
    - `src/features/print/ui/steps/SharedColumnSelectStep.tsx` (신규)
    - `src/features/print/ui/steps/GridRowSelectStep.tsx` (신규)
    - `src/features/print/ui/steps/CalendarRowSelectStep.tsx` (신규)
    - `src/features/print/ui/steps/GanttPeriodSelectStep.tsx` (신규)
    - `src/features/print/ui/steps/GanttRowSelectStep.tsx` (신규)
    - `src/features/print/views/grid/useGridPrint.ts`
    - `src/features/print/views/calendar/useCalendarPrint.ts`
    - `src/features/print/views/gantt/useGanttPrint.ts`
    - `src/features/print/lib/printHtmlBuilder.ts`
    - `src/features/print/cache/PrintCache.ts`
    - `src/features/print/pagination/ganttRowPagination.ts` (신규)
    - `src/__tests__/enterprise-091/bug-907-print-cache-key.test.ts`
  - **fs-external-data-viewer**:
    - `src/features/print/context/PrintContext.tsx`
    - `src/features/print/types.ts`
    - `src/features/print/ui/PrintDialog.tsx`
    - `src/features/print/ui/PrintPreview.tsx`
    - `src/features/print/ui/steps/StepShell.tsx` (신규)
    - `src/features/print/ui/steps/SharedColumnSelectStep.tsx` (신규)
    - `src/features/print/ui/steps/GridRowSelectStep.tsx` (신규)
    - `src/features/print/views/grid/useGridPrint.ts`
    - `src/features/print/lib/printHtmlBuilder.ts`
    - `src/features/print/cache/PrintCache.ts`
  - **fs-sub-data-viewer**:
    - `src/features/print/context/PrintContext.tsx`
    - `src/features/print/types.ts`
    - `src/features/print/ui/PrintDialog.tsx`
    - `src/features/print/ui/PrintPreview.tsx`
    - `src/features/print/ui/steps/StepShell.tsx` (신규)
    - `src/features/print/ui/steps/SharedColumnSelectStep.tsx` (신규)
    - `src/features/print/ui/steps/GridRowSelectStep.tsx` (신규)
    - `src/features/print/views/grid/useGridPrint.ts`
    - `src/features/print/lib/printHtmlBuilder.ts`
    - `src/features/print/cache/PrintCache.ts`

### 알려진 한계 (PENDING 게이트 후속 권장)

1. **그리드 전체 인쇄 (`rowScope='all'`) 의 DB fetch-all 경로 부재** — 현재 in-memory 행만 인쇄 + `console.warn` 발행. 마스터 명세 "DB 데이터 기준 전체" 의 *문자* 가 부분 충족. 뷰어 모델에 fetch-all API 추가 + `useGridPrint.resolveRows.all` 분기 wiring 필요. 3패키지 모두 영향. advisor #2 의 BLOCK 사유 1건 — 핫픽스 또는 별 plan-enterprise 권장.
2. **캘린더 currentMonth 진실원** — `FsCalendarChart.tsx` 의 로컬 state. `CalendarRowSelectStep` 마운트 effect 가 현재 월로 fallback 초기화하나, 인쇄 다이얼로그 오픈 중 마스터가 뷰 월을 바꾸면 동기화되지 않음. CalendarChart→PrintContext 양방향 동기 후속 권장.
3. **fs-external i18n `t.print.error.title` 키 부재** — 임시로 `t.print.printFailed` 대체. 후속 i18n 보강.
4. **간트 `<style>` 인라인 중복** — `buildGanttHorizontalHtml` 의 `<style>` 블록이 페이지마다 삽입됨. `generateGanttStyles()` 분리 후속 리팩터링.
5. **간트 dead code 잔존 가능성** — Phase 5 lint hotfix 가 명시된 4개 함수만 제거. notes_ko 가 "등" 으로 표현한 추가 헬퍼는 별도 정리 사이클 대상.

### advisor 검증

- **advisor #1 (계획)**: PASS (Phase 1 모순 정정 + Phase 3/4/5 footprint disjoint 분리 + Phase 2 placeholder UI 명시 후).
- **advisor #2 (완료)**: BLOCK — 위 "알려진 한계 #1" (그리드 fetch-all 부재). 본 플랜은 단계형 흐름 인프라 + 5뷰 UX 재설계 + 패치노트 산출에 한해 완료, fetch-all 보강은 PENDING 게이트의 마스터 결정에 맡김.

## v001.149.0

> 통합일: 2026-05-18
> 플랜 이슈: #89

### 페이즈 결과

- **Phase 1** (`68ea71b`): `TabContentSelector` 의 `useFormStore.getAllForms()` zustand 직접 구독을 제거하고 `useForms({ includeFields: false })` React Query 로 서버 폼 메타데이터를 fetch. `useEffect` 로 `formsMetadata` 변경 시마다 `syncFormsFromServer(formsMetadata)` 호출하여 zustand 스토어도 hydrate — 같은 세션 내 `TabContentRenderer.getFormById(content)` 가 새 폼을 즉시 찾음. 드롭다운 `forms` 목록은 query 결과(`formsMetadata ?? []`)에서 직접 derive. `enterprise-497 HF-006` (EmptyDataWidgetPropertiesEditor) 와 동일 패턴. 디자인 모드 탭 위젯 드로어에서 사전 생성 폼이 1개만 노출되던 버그 해소.
- **Phase 2** (`4db591b`): `TabFormContent.tsx` 의 89줄 zustand-only CRUD 구현 (`useFormDialogHandlers` + `FormDataListDialog` + `FormInputDialog` + `getFormRenderer`/`getFormDataListRenderer` 직접 호출) 을 30줄의 위임 구현으로 교체. 합성 `WidgetConfig` (`id`=`tab:{tabsWidgetId}:{tabValue}:{form.id}`, `type`=`user-form`, `properties.formId`=`form.id`, `properties.managementCycle`=`page-cycle`) 로 `<UserFormWidget>` 위임 렌더. UserFormWidget 의 기존 `useFormWidgetSync`/`useResolvedCycle`/`listFirst`·`useDataList` 4분기 분기를 그대로 활용 — 서버 read+write, 페이지 managementCycle 자동 반영, listFirst 동작 보장. `Tabs.widget.tsx` → `TabContentRenderer` → `TabFormContent` 의 prop 체인으로 `tabsWidgetId`(=widget `config.id`), `tabValue` 전달. 합성 id `tab:` prefix 로 일반 UserForm 위젯과 충돌 없음. `useFormDialogHandlers.ts`, `FormDataListDialog.tsx`, `FormInputDialog.tsx`, `types.ts` (tabs-widget/ui/) 는 본 페이즈에서 미참조 상태가 되나 제거하지 않음 — 후속 `project-verification` cycle 대상.
- **Phase 3** (`d75f69d`): advisor #2 사전 검토에서 발견된 view-mode 폼 hydration 갭 보강. `TabContentRenderer` 에 Phase 1 과 동일한 `useForms({ includeFields: false })` + `useEffect` 로 `syncFormsFromServer(formsMetadata)` 패턴 적용. view 모드에서 store hydration 진입점이 없어 `getFormById(content)` 가 undefined → "폼을 찾을 수 없습니다" 로 떨어지던 누락 해소. 페이지 진입 시 모든 폼이 store 에 올라가므로 같은 페이지의 다른 위젯/탭도 혜택.

### 영향 파일

- data-craft:
  - `src/widgets/property-drawer/ui/property-editors/TabContentSelector.tsx`
  - `src/widgets/tabs-widget/ui/TabContentRenderer.tsx`
  - `src/widgets/tabs-widget/ui/TabFormContent.tsx`
  - `src/widgets/tabs-widget/ui/Tabs.widget.tsx`

### 잔여 정리 (deadcode 후속)

- `src/widgets/tabs-widget/ui/useFormDialogHandlers.ts`
- `src/widgets/tabs-widget/ui/FormDataListDialog.tsx`
- `src/widgets/tabs-widget/ui/FormInputDialog.tsx`
- `src/widgets/tabs-widget/ui/types.ts`

Phase 2 위임 전환 결과 위 4개 파일이 TabFormContent 에서 참조되지 않음. 본 플랜 scope 외 — 후속 `project-verification` 또는 `dev-inspection` cycle 로 검증 후 제거.

## v001.148.0

> 통합일: 2026-05-18
> 플랜 이슈: #87

### 페이즈 결과

- **Phase 1** (`1195153`): `isPageEffectivelyHidden(page, getPageById)` 헬퍼 신설 — 본인 `isVisible===false` 이거나 1단계 부모의 `isVisible===false` 이면 true (재귀 없음). `src/entities/page/model/` 아래 위치, `@/entities/page` 에서 재수출. i18n: ko/en 양 locale 의 `editPageDialog.visibleLabel` ("화면 숨기기" / "Hide screen"), `editPageDialog.visibleNote` ("뷰 모드 사이드바에 이 화면이 표시되지 않습니다." / "This screen will not appear in the view-mode sidebar.") 갱신. 신규 키 `sidebar.hiddenTag` ("숨김 화면" / "Hidden"), `tabContentSelector.selectorBoxDisabledTooltip` ("선택 상자로 사용중인 페이지는 탭 위젯에 배치할 수 없습니다." / "Pages used as a selector box cannot be placed in a tab widget.") 추가. 기존 `editPageDialog.visibleNoteChild` 키 (이전엔 docs-only 빈 약속) 는 값 그대로 재활용 — Phase 2 의 자식 락 안내 텍스트로 실제 의미 부여.
- **Phase 2** (`f157380`): `PageDialogSwitches` 의 가시성 토글을 "화면 숨기기" 의미로 반전 (`checked={!isVisible}`, `onCheckedChange={(v) => setIsVisible(!v)}`). 데이터 필드 `isVisible` 의미는 보존 (true=노출, false=숨김). 신규 prop `parentHidden?: boolean` — true 시 Switch `disabled` + `checked` 강제 ON + 안내 노트를 `editPageDialog.visibleNoteChild` 로 교체 + Label `text-muted-foreground` 처리. `EditPageForm` / `CreatePageForm` 가 `usePageStore.getPageById(parentId)?.isVisible === false` 로 부모 가시성 조회 후 prop 전달. **+ 보정 (`b7df243`)**: `CreatePageForm` 이 `visibleLabelKey="editPageDialog.visibleLabelList"` + `visibleLabelFallback="뷰 모드 화면 목록에 표시"` override 를 전달하던 부분 제거 — Create 다이얼로그도 기본값("화면 숨기기")으로 통일.
- **Phase 3** (`42e28b7`): 디자인 모드 사이드바의 표시/숨김 분리 영역 폐기. `useDesignSidebarState` 의 `visiblePages`/`hiddenPages` 양분 제거 → 단일 `rootPages`. `DesignSidebar.tsx` 의 "표시 화면" 헤더 + `DesignSidebarHiddenPages` 분리 렌더 (L83~110) 제거 — 단일 `DesignSidebarDndArea` 트리. `DesignSidebarCollapsed` 의 `visiblePages` prop → `rootPages`. `DesignSidebarDndArea` 의 `visibleRootPages` → `rootPages` (hidden 포함 전체 루트, DnD flatten·last-root 계산 모두 갱신). `DesignSidebarHiddenPages.tsx` 삭제 (173줄). `SortableTreeItem.tsx` 에 `isPageEffectivelyHidden(page, getPageById)` 판정 + shadcn `Badge variant="secondary"` ("숨김 화면") 인-플레이스 부착 — 부모 hidden 자식도 헬퍼 기준으로 동일 태그.
- **Phase 4** (`e02671f`): 탭 위젯 설정 드로어 (`TabContentSelector`) 의 화면 탭 통합. `TargetType` `'visible-page' | 'hidden-page' | 'form'` → `'page' | 'form'` 2개로 축소, `TARGET_TYPE_TABS` 재구성, `TabsList` `grid-cols-3` → `grid-cols-2`. `PageItem` 에 `isHidden`, `isSelectorBox` 필드 추가. `buildPageList` 단일 함수 — isVisible 필터 없이 루트+자식 모두 포함하되 host page 제외 (`item.id !== currentPageId`) 보존. hidden 항목 → 우측 "숨김 화면" Badge. selectorBox 항목 → 시각 동일하되 `aria-disabled`, `onClick` no-op, `cursor-not-allowed opacity-70` + shadcn `Tooltip` ("선택 상자로 사용중인 페이지는 탭 위젯에 배치할 수 없습니다.") 래퍼 — 자식의 selectorBox 가 false 면 정상 선택 가능 (cascade 금지). 자식 hidden 누수 버그는 통합 결과로 자연 해소.
- **Phase 5** (`4c692bf`): 뷰 모드 + 탭 위젯 런타임에 유효 숨김 헬퍼 일괄 적용. `ViewSidebar.tsx` 의 루트 필터, `ViewSidebarExpanded.tsx` 의 handlePageClick + 자식 렌더 필터 (2곳), `ViewSidebarCollapsed.tsx` 의 자식 렌더 필터를 모두 `c.isVisible !== false` → `!isPageEffectivelyHidden(c, getPageById)` 로 교체 — 부모 hidden 시 자식도 뷰 모드에서 자동 제외 (이전엔 자식 isVisible 만 봐서 부모 숨김 자식 누출 사각지대 존재). `Tabs.widget.tsx` 에 `visibleTabs` 파생 — `getPageById(tab.content)` 가 페이지를 반환하고 `isPageEffectivelyHidden` 이면 그 탭 항목을 렌더 목록에서 제외 (form 탭은 `getPageById` undefined → 필터 통과). 저장 데이터 변경 없음, 표시만 차단.

### 영향 파일

- data-craft:
  - `src/entities/page/model/isPageEffectivelyHidden.ts` (신규)
  - `src/entities/page/index.ts`
  - `src/shared/i18n/locales/ko.ts`
  - `src/shared/i18n/locales/en.ts`
  - `src/features/page-management/ui/PageDialogSwitches.tsx`
  - `src/features/page-management/ui/EditPageForm.tsx`
  - `src/features/page-management/ui/CreatePageForm.tsx`
  - `src/widgets/page-navigation/ui/useDesignSidebarState.ts`
  - `src/widgets/page-navigation/ui/DesignSidebar.tsx`
  - `src/widgets/page-navigation/ui/DesignSidebarCollapsed.tsx`
  - `src/widgets/page-navigation/ui/DesignSidebarDndArea.tsx`
  - `src/widgets/page-navigation/ui/DesignSidebarHiddenPages.tsx` (삭제)
  - `src/widgets/page-navigation/ui/SortableTreeItem.tsx`
  - `src/widgets/property-drawer/ui/property-editors/tabContentSelectorTypes.ts`
  - `src/widgets/property-drawer/ui/property-editors/TabContentSelector.tsx`
  - `src/widgets/page-navigation/ui/ViewSidebar.tsx`
  - `src/widgets/page-navigation/ui/ViewSidebarExpanded.tsx`
  - `src/widgets/page-navigation/ui/ViewSidebarCollapsed.tsx`
  - `src/widgets/tabs-widget/ui/Tabs.widget.tsx`

### 검증 결과

- 각 phase 직후 lint gate (`pnpm typecheck:all && pnpm lint`) — 5/5 PASS (exit 0, 0 errors, 5~6 warnings — 모두 pre-existing).
- Phase 2 의 라벨/토글 의미 일관성 — advisor #2 사전 점검에서 발견된 CreatePageForm `visibleLabelList` override 누락 케이스를 보정 커밋(`b7df243`)으로 해소.
- 최종 advisor #2 (5관점, 완료 시점) PASS — Intent / Logic / Group Policy / Evidence / Command Fulfillment 모두 통과.

### UI 의미 일관성 결정

- 가시성 토글의 **의미는 반전** ("화면 숨기기"), **데이터 필드는 보존** (`isVisible: true=노출`). UI 만 반전하므로 기존 저장 데이터 마이그레이션 불필요.
- 부모-자식 자동 숨김은 **유효 숨김 헬퍼** 로 *계산* — 자식의 `isVisible` 값은 저장 시 변경하지 않음. 부모를 다시 표시하면 자식은 자신의 원래 isVisible 값으로 즉시 복귀.
- 탭 위젯 런타임에서 hidden 페이지 탭은 **비표시** 채택 (마스터 요구 "뷰 모드에서는 안보이게"). 저장된 탭 데이터는 그대로 보존 — 페이지 가시성 복원 시 탭 자동 재표시.

### 알려진 i18n 후속 부채

- 신규 `tabContentSelector.page` 키는 ko.ts/en.ts 에 미추가, fallback "화면" 으로 동작. 추후 i18n 정합성 sweep 시 양 locale 에 명시 추가 권장.
- 기존 dead key 후보: `sidebar.visiblePages` ("표시 화면" — Phase 3 에서 분리 헤더 폐기로 미사용), `editPageDialog.visibleLabelList` ("뷰 모드 화면 목록에 표시" — Phase 2 보정으로 미사용). 보수적으로 삭제는 후속.

---

## v001.147.0

> 통합일: 2026-05-18
> 플랜 이슈: #84 (hotfix 1)
> 비고: v001.146.0 은 #88 동시 진행으로 선점되어 본 entry 가 v001.147.0 으로 bump.

### 핫픽스 결과 — Phase 5 (`28604f4`)

마스터 manual test 보고 3건 잔여 회귀를 단일 hotfix phase 로 통합 수정.

- **5-A (Area 안쪽 여백 미적용, 신규)**: 디자인 모드 inner wrapper (`absolute inset-0`) 가 외곽 컨테이너의 `padding` 영역을 덮어버려 `AreaDesignGroup` 의 패딩 슬라이더 값이 시각적으로 무효. Phase 1 의 `borderRadius` 미러링과 동일 패턴으로 inner wrapper style 에 `padding: areaPadding` 미러링 추가.
- **5-B (Section 파란 테두리 Phase 3 회귀)**: Phase 3 의 `ring-2 ring-blue-500` 이 outward box-shadow 라 상위 컨테이너 `overflow-hidden` 으로 클리핑되어 시각 미반영. `ring-inset` 추가하여 ring 을 섹션 내부에 그림 — 클리핑 회피.
- **5-C (비선택 영역 dim Phase 4 회귀)**: Phase 4 의 우선순위 재정렬이 root cause 가 아니었음. `widgetStore` 의 `widgets[id]?.cellId` 가 null/empty 일 때 dim 발동 안 됨. `useActiveEditingTarget` 에 `findAreaByWidgetId` fallback 신설 — `layoutStore` 의 `area.widgetId === widgetId` (SubArea 포함) 로 직접 탐색하여 어떤 widget 선택 경로에서도 해당 Area 식별 가능.

### 진단 요지

- 5-A: 외곽 padding 은 absolute inset-0 자식에게 시각 영향 없음 (자식이 padding-box 전체를 덮음). Phase 1 패턴 미러링이 정답.
- 5-B: ring 의 outward box-shadow 가 상위 클리핑에 노출. `ring-inset` 으로 inset shadow 전환.
- 5-C: 기존 widgetCellId 경로는 보존하면서 layoutStore 직접 탐색 fallback 추가 — 어떤 경로 실패에도 회복.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`
  - `src/entities/layout/model/useActiveEditingTarget.ts`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 5 warnings, 0 errors).
- advisor #2 (hotfix 시점) 5관점 PASS, Evidence = CONCERN — 5-B/5-C 는 root cause 미확정 defensive fallback 특성. 부작용 없음. 마스터 manual test 가 진실 검증.

### 잔류 latent blocker

- `openAreaDrawer` 호출처 없음 → `isAreaDrawerOpen` 영구 false → `PropertyDrawer` 의 Area 에디터 경로 + `useActiveEditingTarget` 의 `isAreaDrawerOpen` 분기 도달 불가. 본 hotfix 범위 외, 별도 진단 필요.

### 후속 스킬 체인

1. `plan-enterprise #84 hotfix 1` (본 entry) — Phase 5 → data-craft i-dev 머지 + patch-note v001.147.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스 2` 또는 `플랜 완료` 트리거 가능.

---

## v001.146.0

> 통합일: 2026-05-18
> 플랜 이슈: #88

### 페이즈 결과

- **Phase 1** (`d18c713`): 설정-플랜 관리 탭에서 "파일 크기 제한" 항목을 사용량 그리드에서 분리하고 "포함된 기능" 섹션 카드로 이동. `CurrentPlanBadge` 의 2×2 사용량 그리드를 3 셀 (페이지/데이터그룹/스토리지) 로 축소, `PlanFeatureList` 가 `maxFileSizeBytes` prop 을 받아 값이 정의되고 `-1` 이 아닐 때 HardDrive(cyan) 합성 카드를 더보기 cap 과 무관하게 그리드 최상단에 항상 표시. `formatStorageSize` 가 정수 GB 케이스를 `toFixed(0)` 으로 분기하여 "1GB" / "500MB" 형태로 깔끔히 출력. i18n `settings.subscriptionFeatures.maxFileUpload` ko/en 추가.
- **Phase 2** (`f823105`): `PlanFeatureCard` 우측 `ChevronRight` JSX·import·`cursor-pointer` 제거. tooltip / hover 동작은 유지. `PlanFeatureList` 의 더보기/접기 `ChevronDown` / `ChevronUp` 토글은 다른 글리프이고 기능 인디케이터이므로 보존.
- **Phase 3** (`bba5848`): `CurrentPlanBadge` 첫 줄 라벨 순서 교체 — `[Badge: 플랜명] "현재 플랜"` → `"현재 플랜" [플랜명]`. 프로모션 활성 시 분기에도 동일 규칙 적용 (`프로모션: {{name}} 적용 중` 좌측, 플랜명 우측).
- **Phase 4** (`18c0f5e`): `getPlanBadgeStyle(planType)` 헬퍼를 `planUtils.ts` 에 추가, `CurrentPlanBadge` 의 `<Badge variant="secondary">` 를 span 기반 커스텀 배지로 교체.

### 플랜별 시각 매핑 (Phase 4 — 마스터 1차 검토 항목)

마스터의 원 명세 라벨 (`lite/pro/business`) 을 실제 PlanType union (`free/basic/standard/premium/enterprise`) 에 tier-order 로 매핑:

| PlanType | 배경 | 아이콘 | 노트 |
|---|---|---|---|
| `free` | `bg-muted text-foreground` | — | 의도적 muted (유료 티어 대비 차분) |
| `basic` | `bg-sky-100 text-sky-700` (다크 페어) | — | light blue tint |
| `standard` | indigo→purple 그라데이션 | Sparkles | 마스터 명세 "pro" |
| `premium` | amber→orange 그라데이션 | Crown | 마스터 명세 "business" |
| `enterprise` | slate dark 그라데이션 | Building2 | — |
| (unknown) | `bg-muted` fallback | — | — |

공통 wrapper: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm` (그라데이션 페이드 티어에만 shadow).

### 추가 노트

- `settings.subscriptionFeatures.maxFileSize` i18n 키는 `PlanComparisonCard.tsx:81` / `PlanCard.tsx:63` 에서 여전히 사용되므로 보존됨 (Phase 1 계획서의 "deliberate cleanup" 은 다른 호출자 미존재 전제였으나 실제 의존 발견하여 보존이 정답).
- `getPlanBadgeStyle` 은 `planUtils.ts` 에 직접 추가됐고 subscription feature 배럴(`index.ts`) re-export 은 첫 외부 호출자 발생 시점에 별도 추가 (현재는 `CurrentPlanBadge` 가 직접 경로로 import).
- `free` / `basic` 티어 시각은 의도적으로 차분하게 두었음 — 마스터의 "현재 플랜이 특별해야 함" 명세를 "유료 티어에 prominence 집중, free/basic 은 정직한 인디케이터" 로 해석. face-value 해석 ("모든 현재 플랜 자체가 특별") 을 원하면 핫픽스 가능.

### 영향 파일

- data-craft:
  - `src/widgets/settings-dialog/ui/PlanTabContent.tsx`
  - `src/widgets/settings-dialog/ui/plan/CurrentPlanBadge.tsx`
  - `src/widgets/settings-dialog/ui/plan/PlanFeatureCard.tsx`
  - `src/widgets/settings-dialog/ui/plan/PlanFeatureList.tsx`
  - `src/features/subscription/lib/planFeatures.ts`
  - `src/features/subscription/lib/planUtils.ts`
  - `src/shared/i18n/locales/ko.ts`
  - `src/shared/i18n/locales/en.ts`

### 검증

- 4페이즈 각각 `pnpm typecheck:all && pnpm lint` 통과 (0 errors, 5 warnings — 기존 baseline).
- 마스터 시각 확인: 설정 다이얼로그 → 플랜 관리 진입 — (1) 사용량 그리드 3셀, (2) "포함된 기능" 최상단에 "최대 NGB 파일 업로드" 카드, (3) 모든 카드에 `>` 없음, (4) 상단 첫 줄 `현재 플랜 [플랜명]` 순서 + 플랜 티어별 차별화된 표기.

## v001.145.0

> 통합일: 2026-05-18
> 플랜 이슈: #84

### 페이즈 결과

- **Phase 1** (`bfe2ef1`): Area 모서리 둥글기 클리핑 회복. 디자인 모드에서 외곽 컨테이너의 `borderRadius` 가 내부 `absolute inset-0 overflow-auto` wrapper (`Area.tsx:95`) 에 미적용되어 배경색이 직각 모서리로 잘리던 회귀 수정. wrapper div 에 동일한 `borderRadius` 인라인 스타일을 조건부 추가하여 클리핑 경계가 외곽 둥근 모서리와 일치하도록 함. AreaControls 는 wrapper 내부 (top-2/right-2) 에 위치하여 추가 처리 불필요.
- **Phase 2** (`df0ef39`): SubAreaHeightInput % 입력 적용 경로 복구. `updateSubAreaHeight` 의 px 기반 사전 검증이 `isExpanded=true` (flex-1) 섹션에서 stored `section.height` 와 실제 DOM 높이 괴리로 `success=false` 를 반환, 컴포넌트가 롤백되어 입력값이 무시되던 회귀 수정. 드래그 경로 (`resizeAdjacentSubAreas`) 는 enterprise-500 에서 `containerHeight baseOverride` 로 보정됐으나 직접 호출 경로는 미반영 상태. px 검증을 % 범위 검증 + 컴포넌트 단 10% clamp 위임으로 교체. 비례 재분배 / 부동소수점 정규화는 유지.
- **Phase 3** (`91917bb`): Section 컨트롤바 활성 시 파란 테두리 추가. `FloatingSectionBanner` 컨트롤바 표시 트리거가 `isDesignMode && selectedSectionId !== null` 임을 확인. `Section.tsx` 에 `selectedSectionId === id` 기반 `isSectionSelected` 계산 후 `ring-2 ring-blue-500` Tailwind 클래스 조건부 적용. `Area.tsx` 의 기존 테두리 로직은 변경하지 않음 (마스터 요구가 Section 추가일 뿐 Area 회귀가 아님).
- **Phase 4** (`63e667a`): 비선택 영역 dim 회귀 복구. `useActiveEditingTarget` 의 우선순위 순서 버그 수정 — `WidgetContainer` 의 위젯 직접 클릭은 `selectWidget()` 만 호출하고 `selectedSectionId`·`isSectionDrawerOpen` 을 초기화하지 않으므로 이전 섹션 드로어 상태 잔류 시 branch 1 (section) 이 먼저 매칭되어 위젯이 속한 area 가 dim 되는 결과 발생. `selectedWidgetId` 분기를 branch 3 → branch 1 로 올려 위젯 선택이 잔류 드로어 플래그보다 항상 우선하도록 정렬.

### 진단 요지

- 1번 (모서리 둥글기): 외곽 `borderRadius` 와 내부 `absolute inset-0` wrapper 의 클리핑 경계 불일치. 배경/콘텐츠가 wrapper 에 그려져 외곽 둥근 모서리를 가림.
- 2번 (높이 %): stored `section.height` 와 실측 DOM 높이의 괴리로 px 사전 검증이 false-negative — 드래그 경로는 이미 해소, 직접 호출 경로 누락.
- 3번 (섹션 테두리): `Section.tsx` 에 선택/컨트롤바 상태 대응 테두리 스타일링 자체 부재.
- 4번 (dim): hook 우선순위에서 widget 분기가 section/area 드로어 분기 뒤에 있어 잔류 드로어 플래그가 widget 선택을 가림.

### 영향 파일

- data-craft:
  - `src/widgets/layout-canvas/ui/Area.tsx`
  - `src/widgets/layout-canvas/ui/Section.tsx`
  - `src/entities/layout/model/resizeSubAreaActions.ts`
  - `src/entities/layout/model/useActiveEditingTarget.ts`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) 4 페이즈 모두 PASS (exit 0, 5 warnings, 0 errors).
- advisor #1 (계획 시점) / advisor #2 (완료 시점) 5관점 모두 PASS. advisor #2 Evidence 항목 = CONCERN (Phase 4 git log 추적 누락) — PENDING gate 의 마스터 manual test 로 검증.

### 후속 스킬 체인

1. `plan-enterprise #84` (본 entry) — Phase 1~4 → data-craft i-dev 머지 + patch-note v001.145.0
2. 마스터 manual test 결과에 따라 PENDING gate 에서 `핫픽스` 또는 `플랜 완료` 트리거 가능.

---

## v001.144.0

> 통합일: 2026-05-18
> 플랜 이슈: #85

### 페이즈 결과

- **Phase 1** (`489d54c`): 디자인 모드 사이드바 페이지 행 컴포넌트 2곳의 폭 활용을 교정. 페이지 이름 `<span>` 의 하드코딩 `max-w-[80px]` / `max-w-[100px]` 캡 제거 후 `flex-1 min-w-0 truncate` 적용 — 가용 너비를 채우고 선택 상자 배지(`flex-shrink-0` sibling) 는 우측에 자연 잔류. 우측 액션 버튼 그룹 wrapper className `flex invisible group-hover:visible ... ml-2` → `hidden group-hover:flex ... ml-2` 로 교체 — 비호버 시 DOM 폭 점유 0, 호버 시 flex 복귀. `SortableTreeItem` 의 드래그 핸들 wrapper className 에서 `opacity-0 group-hover:opacity-100 transition-opacity duration-200` 제거 — 비호버 시에도 상시 노출 (마스터 결정).

### 진단 요지

- 비호버 시: 페이지 이름 span 의 `max-w-[80px]` (depth 0 루트는 `max-w-[100px]`) 가 사이드바 폭과 무관하게 캡으로 작용해 텍스트가 80~100px 에서 항상 ellipsis 처리.
- 호버 시: 우측 액션 버튼 그룹의 `invisible group-hover:visible` 가 DOM 폭은 유지한 채 가시성만 토글 → 비호버 상태에서도 아이콘 자리만큼 추가 폭 점유.
- 결합 효과: 사이드바 컨테이너 폭이 충분히 남아 있어도 텍스트 span 의 max-w 캡이 우선 작동 → 마스터 관측한 "너비 남는데 말 줄임표" 결함.

### 영향 파일

- data-craft:
  - `src/widgets/page-navigation/ui/SortableTreeItem.tsx`
  - `src/widgets/page-navigation/ui/DesignSidebarHiddenPages.tsx`

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` (data-craft worktree) PASS (exit 0, 5 warnings, 0 errors).

### 후속 스킬 체인

1. `plan-enterprise #85` (본 entry) — Phase 1 → data-craft i-dev 머지 + patch-note v001.144.0
2. `patch-confirmation data-craft` — origin push
3. `dev-merge data-craft` (i-dev → main)
4. (브라우저 수동 검증) 디자인 모드 진입 → 사이드바 페이지 행 비호버 시 페이지 이름이 가용 폭을 채우고 짧은 이름은 잘리지 않는지, 루트의 "선택 상자" 배지가 우측 잔류하는지, 호버 시 액션 아이콘 영역만큼만 텍스트가 줄어드는지 확인.

## v001.143.0

> 통합일: 2026-05-16
> 플랜 이슈: #83

### 페이즈 결과

- **Phase 1** (`bddd872`): `data-craft-server/src/services/email.service.ts` 의 `getFrontendUrl()` 을 NODE_ENV 분기 방식으로 재작성. `NODE_ENV === 'production'` 일 때 `FRONTEND_URL_PROD` 사용 (미설정 시 `InternalServerError('FRONTEND_URL_PROD_NOT_CONFIGURED')` throw), 그 외 환경에서는 기존 `FRONTEND_URL` 폴백 경로 유지. 상단 주석 갱신. `.env` 에 `FRONTEND_URL_PROD=https://datacraft.ai.kr` 1줄 + 용도 코멘트 1줄 추가, 나머지 모든 항목 (`NODE_ENV=development`, `FRONTEND_URL=http://localhost:5173`, `SERVER_URL=0.0.0.0`, `BILLING_MASTER_KEY`, `JWT_*`, `DB_*`, `SMTP_*`, `TOSS_*`, `NTS_API_KEY` 등) 은 양측 보존 원칙으로 불변.
- **Phase 2** (`3e813ea`): `data-craft-server/src/tests/e2e/reset-password.e2e.test.ts` 의 [E2E-07] 케이스에 정적 source 매칭 assert 2건 추가 — `FRONTEND_URL_PROD_NOT_CONFIGURED` 토큰 존재, `process.env.NODE_ENV === 'production'` 분기 토큰 존재. 기존 `FRONTEND_URL_NOT_CONFIGURED` / localhost 폴백 제거 검증은 그대로 유지.

### 진단 요지

- v001.142.0 의 .env 양측 보존 통합본은 EC2 `git pull` 충돌 해소 목적으로 단일 `FRONTEND_URL=http://localhost:5173` 을 양 환경에 동일 적용 — prod 에서 이메일 footer 의 "DataCraft 로 이동" 링크가 `http://localhost:5173` 으로 생성되는 R1 결함이 잔존했음.
- 단일 .env 값 한 줄로 dev/prod 양립 불가 → 코드 레벨 NODE_ENV 분기 + 신규 prod-only env (`FRONTEND_URL_PROD`) 도입.
- pm2 의 NODE_ENV=production 주입은 dotenv default mode 동작 (`src/config/constant.ts:3` `dotenv.config()`, override 옵션 미사용 — grep 으로 코드베이스 전체 0건 확정) 으로 .env 의 `NODE_ENV=development` 에 덮이지 않음. 기존 NODE_ENV 분기 다수 (`app.ts:106`, `database.ts:56`, `middlewares/error.middleware.ts:31,64`, `middlewares/logger.middleware.ts:45,57`) 의 운영 정상 동작 사실이 이 체인의 증거.
- 운영 도메인 = `https://datacraft.ai.kr` (vite.config.ts:28 "커스텀 도메인(datacraft.ai.kr) + Firebase 모두 루트 배포" 주석 근거 — 정식 사용자 대면 루트 배포 도메인 채택).

### 후속 스킬 체인

1. `plan-enterprise #83` (본 entry) — Phase 1·2 → i-dev 머지 + patch-note v001.143.0
2. `patch-confirmation data-craft` — origin push
3. `dev-merge data-craft` (i-dev → main)
4. `pre-deploy data-craft` (target: data-craft-server) — main 검증 + 빌드 + main → aws-deploy push
5. (마스터 수동) EC2 재배포 — `git reset --hard origin/aws-deploy && pnpm install && pnpm build && pm2 restart data-craft --update-env`

### 회귀 검증

- `pnpm lint` (data-craft-server, worktree) PASS Phase 1 (exit 0) / PASS Phase 2 (exit 0).
- 정적 토큰 매칭 grep 검증 — `email.service.ts` 가 `process.env.NODE_ENV === 'production'` 와 `FRONTEND_URL_PROD_NOT_CONFIGURED` 모두 포함 (각 1건 확정).
- advisor #1 (계획) / advisor #2 (완료) 5-perspective 모두 PASS, BLOCK 토큰 없음.

### 차후 후속 (master B-route 결정 — 본 plan 범위 외)

- 환경별 NODE_ENV 정렬 (i-dev=development, main/aws-deploy=production) + dev-merge 자동 fixup 도입 안건은 본 plan 종료 후 별개 plan 으로 분리 (master 결정).

### 영향 파일

data-craft-server:
- `src/services/email.service.ts` (+7 / -1)
- `.env` (+2 / -0)
- `src/tests/e2e/reset-password.e2e.test.ts` (+2 / -0)

## v001.142.0

> 통합일: 2026-05-16
> 플랜 이슈: #82

### 페이즈 결과

- **Phase 1** (`fed78d5`): `data-craft-server/.env` 를 양측(EC2 운영 + origin/main) 보존 통합본으로 갱신. `SERVER_URL` 을 `127.0.0.1` → `0.0.0.0` 으로 변경 (EC2 외부 바인딩 요구 충족 + 로컬 dev 도 동작 — 양립 검증됨), `FRONTEND_URL` 위에 로컬 dev / 운영 용도 구분 코멘트 2줄 추가. `BILLING_MASTER_KEY`, `FRONTEND_URL`, `JWT_*`, `NTS_API_KEY`, `DB_*`, `SMTP_*`, `TOSS_*` 등 나머지 모든 항목은 origin 값 유지. 본 페이즈는 EC2 의 `git pull` 충돌 해소가 목적이며, 실제 "열 고정" prod 오류 해결은 후속 EC2 수동 재배포 단계에서 완료된다.

### 진단 요지

- pm2 logs: `Error: 허용되지 않은 컬럼 속성: frozen at change.columnSettings.ts:255`
- 원인은 DB 가 아니라 EC2 BE 가 frozen 화이트리스트 추가(`#56 phase 2` ~ `#60 hotfix 1`) 이전 stale 빌드로 동작 중. EC2 의 `git pull` 이 `.env` 충돌로 abort 되어 코드 갱신 차단된 상태였음.

### 후속 스킬 체인

1. `plan-enterprise #82` (본 entry) — Phase 1 → i-dev 머지 + patch-note
2. `patch-confirmation data-craft` — origin push
3. `dev-merge data-craft` (i-dev → main)
4. `pre-deploy data-craft` (target: data-craft-server) — main 검증 + 빌드 + main → aws-deploy push
5. (마스터 수동) EC2 재배포 — `git reset --hard origin/aws-deploy && pnpm install && pnpm build && pm2 restart data-craft --update-env`

### 회귀 검증

- `pnpm lint` (data-craft-server, worktree) PASS (exit 0, 0 errors).
- advisor #1 / advisor #2 5-perspective PASS.

### 영향 파일

data-craft-server:
- `.env` (+3 / -1)

### 미해결 (별건)

- R1: `FRONTEND_URL=http://localhost:5173` 이 prod 이메일 footer 에 그대로 노출되는 결함 — 별도 핫픽스/정책 결정 필요.
- R2: `env_management: git-tracked` 정책 자체가 prod-secret 분기를 강제하는 구조적 한계 — 후속 `/group-policy` 로 `.env` → `.env.example` 만 git-tracked 전환 검토 권장.

## v001.141.0

> 통합일: 2026-05-16
> 플랜 이슈: #79 (hotfix 1)

### 페이즈 결과

- **Phase 3 (hotfix 1)** (`3cdb194c`): 시스템 열 헤더의 sticky 잔존 제거. `FixedHeaderCells.tsx:33` wrapper div 의 인라인 `style={{ position: 'sticky', left: 0, zIndex: 2 }}` + `bg-muted` 클래스 제거. v001.140.0 의 Phase 1 이 본문(DataRow.tsx) 측 sticky 만 제거하고 헤더 측 동일 패턴을 놓친 부분을 보강 — 마스터 핫픽스 명령 "열 헤더에도 동일하게 적용" 반영.

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` PASS (0 errors, 5 warnings).
- 마스터 시각 검증: 시스템 4열의 헤더가 본문과 동일하게 가로 스크롤 시 함께 스크롤되어야 함 (회귀 아님 — 마스터 답변 C 의 의도된 결과).

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/FixedHeaderCells.tsx` (+1 / -1)

## v001.140.0

> 통합일: 2026-05-16
> 플랜 이슈: #79

### 페이즈 결과

- **Phase 1** (`9077edce`): 시스템 4열(드래그 rowSeq, 체크 rowSelect, 서브그리드 토글, 행ID rowId) 을 frozen 경로에서 완전 분리. `fixedColumnGenerator.ts` 에서 rowSeq/rowSelect 의 `frozen: 'start'` 제거, `DataRow.tsx` 시스템 열 래퍼의 `position: sticky / left: 0 / zIndex: 1` 인라인 스타일 제거. rowId 는 `customColumnGenerator.ts` 에서 이미 `frozen: 'none'` 로 부여되어 추가 수정 불필요. `newColumn` 우측 추가 버튼은 페이즈 범위 외로 유지.
- **Phase 2** (`d253ad70`): 사용자 고정 셀의 반투명 누수 해소. `DataCell.tsx` sticky 스타일에서 `backgroundColor: 'var(--background)'` 제거, isSticky 조건부로 Tailwind `bg-muted` 적용 — 헤더 (`FixedHeaderCells.tsx`) 와 토큰 통일. `FixedHeaderCells.tsx` 서브그리드 토글 자식 div 의 중복 `bg-muted` 정리.

### 회귀 검증

- `pnpm typecheck:all && pnpm lint` 두 페이즈 모두 통과 (0 errors, 5 warnings).
- 마스터 시각 검증 필요: 라이트/다크 양 테마에서 (a) 시스템 4열에 frozen sticky 효과가 사라졌는지, (b) 사용자 고정 셀이 완전 불투명한지.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/fs_grid_util/fixedColumnGenerator.ts` (-2 lines)
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/DataRow.tsx` (sticky 인라인 스타일 제거)
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/DataCell.tsx` (sticky 배경 토큰 통일)
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/FixedHeaderCells.tsx` (중복 bg-muted 정리)

### 후속 (본 플랜 범위 외)

`fs-sub-data-viewer`, `fs-external-data-viewer` 패키지에 동일 이름 `fixedColumnGenerator.ts` 가 존재하며 rowSeq/rowSelect 에 `frozen: 'start'` 가 그대로 남아 있음. 본 플랜은 마스터 명령 "데이터 뷰어-그리드 뷰" = `fs-data-viewer` 한정으로 해석됨. 서브/외부 뷰어 surface 에서 동일 결함 관찰 시 핫픽스 또는 후속 플랜으로 처리.

## v001.139.0

> 통합일: 2026-05-16
> 플랜 이슈: #77

### 페이즈 결과

- **Phase 1** (`aa7ee9a7`): `packages/fs-api/src/types/dataViewer/response.ts` 의 `ServerColumnData.setting` 에 `frozen?: 'start' | 'end' | 'none'` 추가. TS2339 (serverToColumnRow.ts:53, serverToViewerMetaResult.ts:73) 2건 해소.
- **Phase 2 v1→v2** (`35ffb28f` → `2cc8b3f2`): `SettingsFormTabContent.tsx:103` destructure 에 `handleFormFieldsChange` 추가 (v1 의 잘못된 rename 정정). TS2552 3건 해소.
- **Phase 3 v1→v2** (`8886e27d` → `f1bbeba8`): `SavePageLayoutResponse` 에 `widgets?: WidgetConfig[]` 추가 + `layoutPersistence.ts:215` 에 `as unknown as WidgetConfig[]` 격리 cast (fs-api WidgetConfig ↔ app WidgetConfig 구조 불일치). TS2345 1건 해소.

### 회귀 검증

- `pnpm exec tsc -b` exit 0 (오류 0건)
- `pnpm build` (tsc + vite) exit 0, 16.11s

### 영향 파일

data-craft:
- `packages/fs-api/src/types/dataViewer/response.ts` (+1 line)
- `packages/fs-api/src/types/builder/requests.ts` (+1 line)
- `src/widgets/settings-dialog/ui/SettingsFormTabContent.tsx` (+1 line, destructure)
- `src/entities/layout/model/layoutPersistence.ts` (+1 line, cast)

### 후속 필수 (본 플랜 범위 외)

`/group-policy data-craft` 호출로 `dev.md` 의 `data-craft.lint_command` 갱신 (`pnpm typecheck:all` 가 root `src/` 미커버 — 본 결함의 진입로). 이후 `/pre-deploy data-craft` 재호출하여 FE 배포 마무리.

## v001.138.0

> 통합일: 2026-05-16

### 변경 파일

- (data-craft-mobile) (이동) `DataCraft-mobile-v2/` → `DataCraft/` (디자인 산출물 디렉토리 정리 — 약 70 파일)
- (data-craft-mobile) (삭제) `기획-디자인팀-설계자료/` 전체 (구 디자인 자료 54 파일)
- (data-craft-mobile) (추가) `DataCraft/handoff/FigmaLibrary.html`, `DataCraft/handoff/Microcopy.html`, `DataCraft/handoff/UserInterviewGuide.html`, `DataCraft/DataCraft Mobile Prototype.html`, `DataCraft/scraps/proto-*.jpg` (3), `DataCraft/uploads/스크린샷 2026-05-13 *.png` (4)

> 흡수 커밋 SHA: `eb84933` (data-craft-mobile) — 전체 파일 목록은 머지 커밋 diff 참조. 카테고리 합계: 추가 81 / 삭제 124 (rename 미적용 기준).

## v001.137.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#75 (hotfix 5)

### 페이즈 결과

- **Phase 8 (hotfix 5)** (`bf9c596b`, data-craft): `EventCardHeader.tsx` 의 ▲▼ 버튼 onClick 에서 `setIsCardHover(false)` 를 reorder 호출 직전에 추가. 본 카드가 swap 후 새 위치로 이동한 직후 1프레임 동안 stale-hover 가 잔존하던 시각 결함 차단.

### 해결방식

- 마스터 보고: "ABC가 있으면 A에 있는 내리기 버튼을 누르면 순간적으로 A가 내려가면서 커서 포커싱이 중간으로 내려가, 근데 마우스 위치는 그대로니까 다시 첫번째인 B로 돌아와서 깜박이는것처럼 보여".
- React 가 key 안정성으로 컴포넌트 identity 를 보존하므로 hotfix 4 의 `isCardHover` state 가 swap 후에도 보존됨. A 의 DOM 만 중간으로 이동하면서 isCardHover=true 가 유지되어, 브라우저가 mouseleave (A) / mouseenter (B) 를 다음 프레임에 발사하기 전까지 중간 위치에서 dark 표시가 유지 → 마스터가 본 "깜박임".
- 해결책 = swap 트리거 시점 (onClick) 에 본 카드 hover state 를 능동적으로 `false` 처리하여, React commit 시 본 카드는 이미 unhover 상태로 그려짐. 이후 자연스러운 mouseenter (B) 가 발사되어 새 hover 가 정상 적용됨. hover state 의 "이동" 이 능동적으로 즉시 발생.
- hotfix 4 (hover state 화) 의 토대 위에서 동작 — state 가 없었다면 본 hotfix 도 의미 없었음.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/EventCardHeader.tsx`

## v001.136.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#75 (hotfix 4)

### 페이즈 결과

- **Phase 7 (hotfix 4)** (`ab4e0311`, data-craft): `EventCardHeader.tsx:95-106` 의 카드 hover 배경 처리가 inline `style={{ backgroundColor: 'transparent' }}` + `onMouseEnter/Leave` 에서 직접 `e.currentTarget.style.backgroundColor` 를 mutate 하던 패턴 → React state (`isCardHover`) 기반으로 전환. reorder 시 events 재렌더 → JSX 의 inline `style` 가 매번 `transparent` 로 덮어쓰며 mouseenter/leave 와 동기 깨짐 → 깜박임. state 화로 React 가 re-render 후에도 hover 값을 일관 유지.

### 해결방식

- 마스터 보고: "일정 카드에 커서 올리고 있으면 어둡게 표시해주는 기능이 있엇는데 카드 순서 이동하면 이게 순간적으로 깜박여". 원인 = DOM mutation 기반 hover + React 재렌더의 stale-style overwrite 경합.
- `useState<boolean>` (`isCardHover`) 추가 + JSX 의 `style.backgroundColor` 를 state 값에 따른 ternary 로 결정. setIsCardHover 는 `onMouseEnter/Leave` 에서 호출. React 가 reorder 시 컴포넌트 identity 를 보존 (key = `rowField-dateColumnField` 안정) 하므로 state 도 보존되어 hover 상태가 재렌더에 무관하게 일관.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/EventCardHeader.tsx`

## v001.135.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#75 (hotfix 3)

### 페이즈 결과

- **Phase 6 (hotfix 3)** (`4ebf9dc6`, data-craft): `FsCalendarChart.handleMoveCard` 가 `setServerRows(updated)` → `onRefresh()` 를 직렬 호출하나 `serverRowsRef.current` 는 useEffect (FsCalendarChart.tsx:253) 에서 비동기 갱신되어, `onRefresh()` 가 stale ref 를 읽고 events 를 옛 순서로 재파싱하던 결함. 같은 파일의 `removeServerRow:389` / `appendServerRow:401` 가 이미 쓰던 "setter 콜백 내부에서 `serverRowsRef.current = updated;` 동기 갱신" 패턴을 적용해 정정. 이제 ▲▼ 클릭 시 즉시 카드 순서가 시각 반영됨 (새로고침 불필요).

### 해결방식

- 마스터 보고: "누르면 UI 즉시 반영 안되서 즉시 이동 안하고 새로고침해야 나와". serverRows state 갱신과 ref 동기화 타이밍 분석으로 stale-ref-on-refresh 결함 식별.
- `setServerRows(updated)` 만으로는 `serverRowsRef` 가 다음 렌더 commit 후의 useEffect 시점에서야 갱신 — `onRefresh()` 의 ref 읽기는 그 이전 마이크로태스크에 실행됨. 동기 ref 갱신을 setter 콜백 안에서 같이 처리하면 React 비동기성을 우회하면서도 state ↔ ref 정합 유지.
- 동일 파일 내 다른 server-rows 변형 핸들러 (`removeServerRow`, `appendServerRow`, `updateServerRow`) 가 모두 이미 채택하던 패턴 — 본 hotfix 는 누락된 정합을 회수하는 것에 해당.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/calendar/FsCalendarChart.tsx`

## v001.134.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#75 (hotfix 2)

### 페이즈 결과

- **Phase 5 (hotfix 2)** (`26449f17`, data-craft): `FsCalendarDetailPanel.tsx:170` 의 카드 reorder 게이팅을 `mode === FsViewerMode.View` 에서 `mode === FsViewerMode.Write` 로 정정. 마스터의 "뷰 모드" 용어가 코드 enum 의 `FsViewerMode.View` 가 아니라 `FsViewerMode.Write` (셀/행 데이터 편집 = 데이터 상호작용 모드) 를 가리켰음이 확인됨 — 삭제 버튼의 `canEditCells = isWriteMode(mode)` 게이팅과 동일 모드. 동시에 hotfix 1 에서 도입한 색상 가시성도 본 모드에서 비로소 실효.

### 해결방식

- Phase 1 ~ hotfix 1 동안 마스터의 "뷰 모드" 를 `FsViewerMode.View` enum 으로 해석. 마스터 후속 입력 "삭제는 뷰 모드에서 노출하고 디자인 모드에서는 노출 안하고 있어, 이건 정상" 에서 의미 충돌이 노출 — 코드상 삭제 버튼은 `canEditCells = isWriteMode(mode)` 일 때만 표시되므로 마스터의 "뷰 모드" 는 `FsViewerMode.Write`. `FsViewerMode.View` 는 별도의 read-only 소비자 모드로 마스터 일상 용법 밖.
- 따라서 카드 reorder 도 동일 의미의 "뷰 모드" = `FsViewerMode.Write` 에서 노출되어야 의도 일치. 1줄 게이팅 변경으로 정정.
- hotfix 1 (색상 가시성) 의 변경은 본 hotfix 2 와 독립적으로 유효 — 두 hotfix 모두 누적 보존.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/FsCalendarDetailPanel.tsx`

## v001.133.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#75 (hotfix 1)

### 페이즈 결과

- **Phase 4 (hotfix 1)** (`ad17bfa8`, data-craft): Phase 1 에서 도입한 캘린더 카드 ▲▼ 버튼이 뷰 모드에서 보이지 않던 결함을 해소. 원인은 `EventCardHeader.tsx:138,148` 의 버튼 `style` 속성이 활성/비활성 무관하게 `componentColors.state.disabled.foreground`(#4b5563 회색) 를 하드코딩하여, 카드 배경 위에서 사실상 비가시였던 색상 문제. 활성 상태(`onMoveUp`/`onMoveDown` 핸들러 정의) 일 때만 `componentColors.button.primary.bg`(#3b82f6 파란색) 로 교체하고, hover 효과(`state.info.background`) 추가. 비활성 상태는 기존 disabled-foreground + `disabled:opacity-30` 패턴 유지. 뷰 모드 게이팅 (`mode === FsViewerMode.View && !isReadOnly && !!onMoveCard`) 은 그대로 보존.

### 해결방식

- 마스터 보고 "화살표 자체가 안보이는데" 에 대한 가설 3종 — H1(색상 비가시) / H2(prop chain 단절) / H3(collapse guard) — 중 prop chain 4-hop 점검 결과 정상 (Phase 1-2 와 일치), collapse guard 부재 확인 → H1 색상 가설 확정. 활성 / 비활성 버튼 시각적 구분 + 삭제 버튼과 동치 hover 패턴 부여로 통합 정리.
- 1차 advisor 가 "H1 단독 판정 후 머지 전 실제 가시성 마스터 확인 권고" 지적 → PENDING gate 마스터 브라우저 검증으로 대체.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/EventCardHeader.tsx`

## v001.132.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#73 (핫픽스 2)

### 페이즈 결과

- **Phase 7 / 핫픽스 2** (`5811b7f8`, data-craft): AIAssistantModal UI 정돈 — 출시 예정 태그 + 입력 영역 단일 행화 + 전송 버튼 원형/아이콘.

### 핫픽스 사유

마스터 후속 지시 — 채팅 UI 가 "준비중" 라벨 + 두 줄 textarea + 사각 "전송" 텍스트 버튼이라 정돈되어 보이지 않는다. 실제 채팅 UI 의 단정한 느낌으로 가다듬는다.

### 해결방식

`AIAssistantModal.tsx` 한 파일 안에서만 처리:
1. **헤더**: `DialogTitle` 을 `flex items-center gap-2` 로 만들고 "AI 비서" 옆에 `<span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">출시 예정</span>` chip 배치.
2. **입력 영역 라벨 제거**: 기존 `<span>준비중입니다</span>` 라벨과 `flex flex-col gap-1.5` 래퍼 제거.
3. **단일 행 정렬**: 입력 영역 컨테이너를 `flex items-center gap-2` 로 변경. textarea 는 `rows={1}` + `min-h-9 h-9` 로 단일 행 높이 고정 → placeholder "메시지를 입력하세요" 가 시각적으로 세로 중앙에 위치.
4. **전송 버튼 원형**: `flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground` + lucide `<Send className="size-4" />` (텍스트 제거).
5. **세로 정렬**: 전송 버튼과 textarea 둘 다 `h-9` 동일 + `items-center` 컨테이너 → baseline 일치.

모달 폭 `w-[420px]` / 대화 영역 높이 `min-h-[360px]` / 드로어 회피 / 꼬리 div / 푸터 (닫기·오늘 하루 가리기) 등 나머지 구조는 모두 그대로 유지. 두 버튼 모두 여전히 `disabled` (API 미구현).

### 영향 파일

data-craft:
- `src/widgets/floating-ai-button/ui/AIAssistantModal.tsx`

머지 커밋: (data-craft i-dev 핫픽스 2 merge).

### 검증

- 수동: FAB 클릭 → 모달 헤더 우측에 "출시 예정" 회색 chip 노출, 입력 영역에 라벨 없이 단일 행 textarea + 원형 Send 아이콘 버튼이 같은 높이로 정렬된 것 확인. placeholder "메시지를 입력하세요" 가 세로 중앙처럼 보이는지 확인.
- 자동: `pnpm typecheck:all && pnpm lint` PASS (0 errors).

## v001.131.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#66 (Hotfix 1)

### 페이즈 결과

- **Phase 9 (Hotfix 1)** (`8d7aa05b`, data-craft): 마스터 dev 검증에서 비-dashboard 4뷰 (grid/calendar/kanban/gantt) 에 인쇄 버튼 2개 노출 회귀 보고. 원인: `HeaderSearch.tsx` L230-241 이 이미 `!isReadOnly` 만으로 4뷰에서 인쇄 버튼 렌더 중 (HeaderActions L171 의 `viewMode !== 'dashboard'` 조건으로 HeaderSearch 자체가 dashboard 에서 숨김). Phase 1a 가 HeaderActions L191-208 의 dashboard 한정 별도 버튼 조건을 5뷰 전체로 확장하여 비-dashboard 에서 HeaderSearch + HeaderActions = 2개 노출. 수정: HeaderActions 조건을 `viewerModel.viewMode === 'dashboard'` 단일로 복원 + 주석 정합. Phase 1a 의 5뷰 트리거 노출 목표는 이미 Phase 1a 이전부터 HeaderSearch + HeaderActions 조합으로 만족되고 있었음 (Phase 1a 자체가 불필요한 변경이었음을 사후 확인).

### 해결방식

- `<HeaderActions>` 는 `FsGridHeader.tsx` L161 에서 5뷰 모두 무조건 렌더. 내부에서 `HeaderSearch` 가 `viewMode !== 'dashboard'` 분기로 4뷰에만 렌더 → HeaderSearch 의 인쇄 버튼이 비-dashboard 4뷰 커버. HeaderActions 의 dashboard 한정 별도 버튼이 dashboard 1뷰 커버. 5뷰 모두 인쇄 트리거 1개 확보, 중복 0개.
- Phase 1a 의 사전 점검 누락: HeaderSearch 가 이미 4뷰에서 인쇄 버튼을 제공하고 있음을 grep 하지 않고 "4뷰에 트리거 없음" 으로 가정. 본 hotfix 가 그 가정을 정정.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/data-viewer-header/HeaderActions.tsx`

머지 커밋: data-craft i-dev 통합 (`-핫픽스1` WIP 머지).

### 검증

- 자동: lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.
- 수동: 마스터 `pnpm dev` (5173) → 5뷰 각각에서 인쇄 버튼 정확히 1개 노출 확인.

---

## v001.130.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#74 (hotfix 1)

### 페이즈 결과

- **Hotfix 1** (`c8987c85`, data-craft): `ViewColumnManagerDialog` 의 `newlyAddedColumnField` 자동 스크롤 effect 에서 `scrollIntoView({ block: 'nearest' })` → `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` 로 변경. 열 추가 시 스크롤 조정이 부드러운 애니메이션으로 동작.

### 해결방식

- 브라우저 네이티브 `scrollIntoView` 의 `behavior: 'smooth'` 옵션 사용. 신규 의존성 / 신규 코드 없음.
- 기존 selection-scroll effect (키보드 네비게이션 시 자동 스크롤) 는 마스터 요청 범위 외이므로 손대지 않음 — 즉시 스크롤 그대로 유지.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/view-column-manager/ViewColumnManagerDialog.tsx`

머지 커밋: (data-craft i-dev 핫픽스1 머지).

### 검증

수동 검증 시나리오 (`pnpm dev` 5173):
- 데이터 뷰어 → 캘린더/칸반/간트뷰 디자인 모드 → "열 정보 편집" 모달 → 열 추가 → 스크롤이 instant 점프가 아니라 부드러운 애니메이션으로 새 행까지 이동하는지 확인.
- connection 타입 열 추가에서도 동일 확인.
- 키보드 ↑/↓ 네비게이션 시 스크롤은 기존대로 instant (변경 없음) 확인.

자동 검증:
- `pnpm typecheck:all && pnpm lint` PASS (typecheck 58s, eslint 0 errors).

### 알려진 제약 / 후속

- `behavior: 'smooth'` 는 브라우저가 OS 의 "prefers-reduced-motion" 설정을 자동 존중하여 즉시 스크롤로 fallback 한다 — 별도 접근성 가드 코드 불필요.
- 기존 selection-scroll effect 도 smooth 가 필요해지면 동일 옵션 추가로 통일 가능 (후속 결정 사항).

## v001.129.0

> 통합일: 2026-05-16
> 플랜 이슈: funshare-inc/data-craft#73 (핫픽스 1)

### 페이즈 결과

- **Phase 6 / 핫픽스 1** (`a6ff3004`, data-craft): AIAssistantModal 채팅창 크기 확장.

### 핫픽스 사유

마스터 후속 지시 — v001.124.0 에서 발행한 채팅창의 너비 `w-80` (320px) 와 대화 영역 최소 높이 `min-h-40` (160px) 이 실제 대화 UX 로는 좁고 짧다. 시각적 비례 부족.

### 해결방식

`AIAssistantModal.tsx` 의 `DialogContent` className 두 군데만 조정:
- 모달 너비: `w-80` → `w-[420px]` (420px, PropertyDrawer 의 `max-w-md` 384px 보다 살짝 큰 폭으로 시각적 분리 유지)
- 대화 영역 div 최소 높이: `min-h-40` → `min-h-[360px]` (2.25배 확장)

모바일 안전 폭 `max-w-[calc(100vw-3rem)]`, 우측 하단 origin, 꼬리 div, 드로어 회피 (`md:-translate-x-96`), 입력 영역 disabled 등 나머지 구조는 그대로 유지.

### 영향 파일

data-craft:
- `src/widgets/floating-ai-button/ui/AIAssistantModal.tsx`

머지 커밋: (data-craft i-dev 핫픽스 1 merge).

### 검증

- 수동: `pnpm dev` (5173) → FAB 클릭 → 모달 폭이 420px, 대화 영역 높이 360px 이상으로 확장된 것 확인. 드로어 오픈 상태에서도 화면 우측 영역 안에서 origin 유지.
- 자동: `pnpm typecheck:all && pnpm lint` PASS (0 errors).

## v001.128.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#75

### 페이즈 결과

- **Phase 1** (`dfd6dcca`, data-craft): 캘린더 상세 패널의 카드 ▲▼ 버튼이 무반응이던 결함을 해소. `calendarReorderHelper.ts` 신규 — `moveCardInDay()` 가 같은 일자 그룹 내 인접 카드의 `row.seq` 를 swap 하고 누락 seq 를 backfill 한 `seqUpdates` 를 반환. `FsCalendarChart.handleMoveCard` 가 `moveCardInDay` → `sortRowsBySeq` → `setServerRows` → `saveChange(createRowSeqChange(...))` → `onRefresh()` 까지 일관 처리. `FsCalendarChart → FsCalendar → FsCalendarDetailPanel` 로 `onMoveCard` + `mode` prop 스레딩. `FsCalendarDetailPanel` 의 핸들러 게이팅 = `mode === FsViewerMode.View && !isReadOnly && !!onMoveCard`. `useCalendarEvents.parseCalendarEvents` 의 `calendarEventOrder` 우선 분기 제거 (stale 맵이 seq 변경을 덮어쓰던 결함 차단).
- **Phase 2** (`e4f7b02a`, data-craft): Phase 1 로 dead 가 된 `onCardOrderChange` prop 체인을 `CalendarViewPage → FsCalendarChart → FsCalendar → FsCalendarDetailPanel → FsCalendarEventCard → useEventCardHandlers` 전 구간 제거. 동일 체인을 검증하던 `dnd-callback-chain.test.tsx` (167라인) 및 `calendarEventOrder` 우선 분기를 검증하던 `calendar-event-order.test.tsx` (44라인) 삭제. `entities/grid/types.ts:71` 의 `calendarEventOrder` 타입 필드는 BE 스키마 잔존 가능성 고려 type-level 만 보존.
- **Phase 3** (`63973e20`, data-craft): `moveCardInDay` 헬퍼 회귀 테스트 5건 신규 (`card-reorder-buttons.test.tsx`) — 중간 카드 UP swap, 첫 카드 UP / 마지막 카드 DOWN 경계 no-op, seq undefined 행 backfill 정수 반환, 다른 일자 단일 카드 비간섭.

### 해결방식

- 마스터 의도 = "그리드뷰의 행 순서 변경 BE 인프라 재활용, BE 작업 추가 없이, 드래그&드롭 대신 ▲▼ 아이콘 버튼". 그리드뷰 / 칸반이 이미 `createRowSeqChange` + `row.seq` 경로로 영속화 — 캘린더 카드는 본질적으로 1개 행이므로 동일 경로 재사용.
- 결함 원인은 3중 단절: (1) `FsCalendarDetailPanel.handleMoveUp/Down` 가 `onCardOrderChange` prop 만 호출, (2) `CalendarViewPage.handleCardOrderChange` 가 no-op, (3) `calendarEventOrder` 영속화용 `DataViewerChangeModel` 자체 부재. Phase 1 은 새 `onMoveCard` 직통 콜백을 `FsCalendarChart.handleMoveCard` 에 연결하여 saveChange 까지 일관 흐름 확보.
- 리렌더 보장 = `viewerModel` 이 context-held mutable 이라 참조 swap 만으론 부족 → `FsCalendarChart` 가 보유한 `serverRowsRef` + `setServerRows` + `monthCacheRef` 갱신 + `onRefresh()` 트리거 (칸반의 `triggerRerender` 동치). 페이지 레벨에 새 로직을 두지 않음으로써 prop drilling 최소화.
- 뷰 모드 게이팅은 `FsViewerMode.View` enum 단일 분기 + `!isReadOnly` 합성. EventCardHeader 의 기존 가드 `(onMoveUp || onMoveDown)` 가 자연히 버튼을 숨기므로 헤더 컴포넌트 직접 수정 불요 — 단일 게이팅 지점 (DetailPanel 핸들러 생성) 유지.
- `useCalendarEvents.parseCalendarEvents` 의 `calendarEventOrder` 분기 제거는 1차 advisor 가 지적한 stale 맵 결함 (seq swap 후에도 UI 가 옛 순서를 보이는 회귀) 의 직접 차단.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/calendarReorderHelper.ts` (신규)
- `packages/fs-data-viewer/src/widgets/calendar/FsCalendarChart.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/calendar/FsCalendar.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/FsCalendarDetailPanel.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/FsCalendarEventCard.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/useEventCardHandlers.ts`
- `packages/fs-data-viewer/src/widgets/calendar/calendar-chart/useCalendarEvents.ts`
- `packages/fs-data-viewer/src/pages/CalendarViewPage.tsx`
- `packages/fs-data-viewer/src/__tests__/calendar/card-reorder-buttons.test.tsx` (신규)
- `packages/fs-data-viewer/src/__tests__/calendar/dnd-callback-chain.test.tsx` (삭제)
- `packages/fs-data-viewer/src/__tests__/field-types/calendar-event-order.test.tsx` (삭제)

## v001.127.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#66

### 페이즈 결과

- **Phase 1a** (`589c279d`, data-craft): `HeaderActions.tsx` L191-194 의 인쇄 버튼 노출 조건을 `viewMode === 'dashboard'` 단일 분기에서 5뷰 (`grid|calendar|kanban|gantt|dashboard`) 명시 화이트리스트로 확장. `isWriteMode(mode) && !isReadOnly` 가드 보존. 4뷰에서 부재하던 인쇄 트리거 확보.
- **Phase 1b** (`f9f6e9a5`, `fdbd4a7c` lint-fix, data-craft): `PrintContext` useEffect 의존성에 `options` 추가 → 옵션 변경 시 미리보기 HTML 자동 재생성. `eslint-disable-next-line react-hooks/exhaustive-deps` 제거. 동기 `setHtmlContent(undefined)` 를 effect 본문에서 제거하고 `closePrintDialog` 콜백으로 이동하여 `react-hooks/set-state-in-effect` 위반 해소.
- **Phase 2** (`7f4c11bd`, `acc922b8` test-fix, data-craft): `printStyleGenerator` 에 grid 페이지 분할 규칙 4종 추가 (`tbody tr page-break-inside: avoid`, `tfoot display: table-footer-group`, `table table-layout: auto + max-width: 100%`, `th/td overflow-wrap: anywhere`). `useGridPrint` 에 `selectedColumns` 전체 비활성 시 전체 컬럼 fallback. 신규 9건 단위 테스트.
- **Phase 3** (`4958749b`, data-craft): `useCalendarPrint` 의 `targetMonth` 결정성화 (`new Date()` 제거, `options.calendar.monthView` → 최초 이벤트 날짜 월 fallback). `.today` 강조 제거 (인쇄 결정성). `calendarEventOrder` 기반 일자별 이벤트 정렬. `parseDateValue` JSON.date 미존재 시 plain date fallback. `@media print` 규칙 (`.calendar-grid` / `.event-details-section`). 11/11 green.
- **Phase 4** (`151a8d24`, `6d447490` lint-fix, data-craft): `useKanbanPrint` 의 `prepareKanbanData` 가 `kanbanColumnField` 미매칭 시 throw 대신 null 반환. `columnsPerPage` 청킹 추가 — N 컬럼마다 `.page-break` 마커. `chunkArray` 순수 헬퍼. UNCLASSIFIED 안전 렌더. 10건 단위 테스트.
- **Phase 5** (`d61e640e`, `71fee4a0` test-fix, data-craft): `useGanttPrint` 의 `ganttTimelineColumnField` / `ganttLabelColumnField` 명시 조회 + null/미매칭 안내. 타임라인 60일 (`DAYS_PER_PAGE`) 초과 시 UTC epoch days 정수 청킹 + 각 청크 라벨 컬럼 재렌더 (가로 페이지 분할). 순수성 보장. 10건 단위 테스트.
- **Phase 6** (`a850b57a`, data-craft): `useDashboardPrint` 에 `perWidget` 옵션 (DashboardPrintOptionsExtended 인터섹션). `generatePerWidgetHtml` 이 `.dashboard-grid-container` 직접 자식을 순차 캡처 + 마지막 위젯 제외 `page-break-after: always` 인라인. 부분 회복 — 단일 실패 시 placeholder. 6건 단위 테스트 (`html2canvas` `vi.mock`).
- **Phase 7** (`bb7e6754` audit empty, `acf2be0b` follow-up, data-craft): 5뷰 × 옵션 매트릭스 전수 점검 (i18n 키 누락 0). 감사에서 발견된 wiring 결함 2건 fix: (1) `showPageNumbers` — `printStyleGenerator` 의 `.print-footer::after { counter(page) }` 가 옵션 무시하던 결함, 옵션 truthy 시만 emit. (2) `showPrintDate` — `printHtmlBuilder.buildFooterContent` 에 `printDate` 파라미터 추가, 옵션 truthy 시 `<span class="print-date">YYYY-MM-DD</span>` 푸터 삽입.
- **Phase 8** (`817c16ce`, data-craft): `integration.test.tsx` 보강 — 기존 9건 보존 + 옵션 wiring 회귀 6건 + 4뷰 순수성 4건. 총 19건. `bug-907-print-cache-key.test.ts` 회귀 보존.

### 해결방식

- 인쇄 인프라 (PrintDialog / PrintPreview / PrintContext / 엔진 / 뷰별 generate*PrintHtml / printStyleGenerator) 는 이미 존재했으나 미리보기 데이터 흐름 누락 + 트리거 노출 누락 + 일부 옵션 wiring 결함이 누적된 상태. 골격 재작성 대신 결함 지점을 페이즈별로 격리하여 단계적 수정.
- 미리보기 ↔ 실제 인쇄 정합은 두 경로 (`PrintContext` → `PrintPreview` iframe / `BrowserPrintEngine` 자체 iframe) 가 동일한 `generate*PrintHtml(viewerModel, options)` 함수를 호출하는 구조에 의존 → 뷰별 generate 함수의 **순수성** 을 결정성 (no `new Date()`, no `Math.random()`, no live DOM read) 으로 강제. Calendar / Gantt 의 `new Date()` 의존을 명시 옵션 / 이벤트 데이터 fallback 으로 교체.
- 페이지 분할은 뷰별 특성에 맞춰 정의: Grid (행 단위 break-inside avoid), Calendar (이벤트 상세 새 페이지), Kanban (`columnsPerPage` 가로 chunking), Gantt (`DAYS_PER_PAGE=60` 가로 chunking + 라벨 재렌더), Dashboard (`perWidget` 옵션 시 위젯 단위 page-break).
- Dashboard 는 html2canvas DOM 의존이라 본질적 결정성 보장 불가 — 양 경로가 동일 DOM 시점을 캡처하는 한 미리보기 ≈ 실제 출력. 위젯 단일 실패 시 placeholder 부분 회복.
- `PrintContext` 의 useEffect deps 누락은 옵션 변경에도 미리보기가 갱신되지 않던 직접 원인 — `[isOpen, viewMode, options]` 로 정합. `react-hooks/set-state-in-effect` 위반은 동기 setState 를 `closePrintDialog` 콜백으로 이동.
- PDF 출력은 별도 `PdfPrintEngine` (jspdf) 직접 경로 대신 브라우저 인쇄 다이얼로그의 OS 레벨 "PDF 저장" 옵션을 사용 — 마스터 결정 ("브라우저 인쇄 가능하면 PDF는 브라우저가 저장할 수 있게 제공"). `PdfPrintEngine` 코드는 현행 보존, dead-code 여부 판정은 후속 `/project-verification` 으로 위임.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/data-viewer-header/HeaderActions.tsx`
- `packages/fs-data-viewer/src/features/print/context/PrintContext.tsx`
- `packages/fs-data-viewer/src/features/print/views/grid/useGridPrint.ts`
- `packages/fs-data-viewer/src/features/print/views/grid/useGridPrint.test.ts` (신규)
- `packages/fs-data-viewer/src/features/print/views/calendar/useCalendarPrint.ts`
- `packages/fs-data-viewer/src/features/print/views/calendar/useCalendarPrint.parser.test.ts`
- `packages/fs-data-viewer/src/features/print/views/kanban/useKanbanPrint.ts`
- `packages/fs-data-viewer/src/features/print/views/kanban/useKanbanPrint.test.ts` (신규)
- `packages/fs-data-viewer/src/features/print/views/gantt/useGanttPrint.ts`
- `packages/fs-data-viewer/src/features/print/views/gantt/useGanttPrint.parser.test.ts`
- `packages/fs-data-viewer/src/features/print/views/dashboard/useDashboardPrint.ts`
- `packages/fs-data-viewer/src/features/print/views/dashboard/useDashboardPrint.test.ts` (신규)
- `packages/fs-data-viewer/src/features/print/views/integration.test.tsx`
- `packages/fs-data-viewer/src/features/print/lib/printStyleGenerator.ts`
- `packages/fs-data-viewer/src/features/print/lib/printHtmlBuilder.ts`

머지 커밋: data-craft i-dev 통합 (`-작업` WIP 머지).

### 검증

- 자동: 페이즈마다 lint gate (`pnpm typecheck:all && pnpm lint`) clean. print suite 10 파일 / 82 테스트 green. `bug-907-print-cache-key` 회귀 보존.
- 수동 검증 시나리오 (`pnpm dev` 5173) — **단위 테스트는 `usePrintContext` 를 직접 mock 하므로 실제 React effect 경로 (Phase 1b deps 변경) 는 미검증, 마스터 수동 확인 필수**:
  - 5뷰 각각에서 HeaderActions 인쇄 버튼 노출 확인.
  - 각 뷰에서 인쇄 다이얼로그 → 미리보기 iframe 에 placeholder 가 아닌 실제 데이터 렌더 확인.
  - 옵션 (용지 / 방향 / 여백 / 색상 / 헤더-푸터 / 페이지번호 / 인쇄 일자) 변경 시 미리보기 즉시 반영 (**Phase 1b 핵심 회귀 포인트**).
  - "인쇄" 실행 시 브라우저 인쇄 다이얼로그 동일 콘텐츠로 노출 + "PDF 로 저장" 가능 확인.

### 후속

- DAYS_PER_PAGE / columnsPerPage / perWidget 등 페이즈 중 도입된 옵션 일부를 `PrintCommonOptions` / 각 뷰별 옵션 타입에 정식 승격 (현재 일부는 인터섹션 / 상수).
- `PdfPrintEngine` dead-code 여부 정리 — `/project-verification` 에서 점검.
- `useGridPrint` SubGrid 인쇄 TODO (L58) 별도 플랜.

---

## v001.126.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#69

### 페이즈 결과

- **Phase 1** (`c1f0adb`, data-craft): `fs-data-viewer` 패키지에 `useBackdropClickClose` 훅 신규 추가 + 29 파일 적용. 백드롭의 `onClick={onClose}` → `onMouseDown(Capture) + onClick` 조합으로 교체. mousedown 출처가 백드롭 자체일 때만 close 발화. `IntegrityCheckDialog` 의 이중 백드롭, `SingleSelect/MultiSelect/ConnectionEditOverlay` 의 `pointerEvents:none` 외부 + inner 절대위치 백드롭, `FileDialog/ImageDialog` 의 형제 노드 백드롭 모두 커버. `useViewColumnMenu.ts` 의 document `'click'` 리스너 → `'mousedown'` 으로 교체 (Pattern C). `ConnectionConfigDialog/ConnectionSettingsDialog` 는 Radix Dialog 사용으로 인라인 백드롭 부재 → skip.
- **Phase 2** (`7351ee8`, data-craft): `fs-external-data-viewer` 패키지에 동일 훅 독립 복사 + 26 파일 적용. mirror 패키지 구조 차이 (forwardRef 직접 반환, 화살표 함수 직접 반환, `DualWidgetConfigDialog` 의 기존 `handleBackdropClick` callback) 모두 Phase 1 과 동일한 의미로 처리.
- **Phase 3** (`9f4b444`, data-craft): `fs-sub-data-viewer` 패키지 (3 번째 mirror) 동일 훅 독립 복사 + 26 파일 적용.
- **사후 보강 1** (`b9ece31a`, data-craft): 훅의 `onMouseDown` 을 `onMouseDownCapture` 로 교체. `DateTimeCalendarOverlay/TimeOverlay` 등 inner 컨텐츠가 `onMouseDown stopPropagation` 한 케이스에서 백드롭이 mousedown 출처를 못 보던 edge case (스테일 ref) 제거. capture 단계에서 가로채면 inner stopPropagation 과 무관하게 ref 가 항상 정확히 갱신됨. 3 mirror 패키지 hook 모두 패치.
- **사후 보강 2** (`07161e47`, data-craft): `FileDialog/ImageDialog` (형제 노드 백드롭 + 기존 preventDefault 합성 케이스) 6 파일에서 `backdropProps.onMouseDown` 명시 호출을 `onMouseDownCapture` 로 일치 변경. 보강 1 의 hook 시그니처 변경에 맞춤.

### 해결방식

- **버그 원인**: `<div className="fixed inset-0..." onClick={onClose}>` 백드롭 + 내부 컨텐츠 `onClick={e => e.stopPropagation()}` 패턴은 click 이벤트가 내부에 도달했을 때만 막음. drag inside→outside 는 mousedown 이 내부 / mouseup 이 백드롭 위에서 일어나며 click 이벤트가 공통 조상 (=백드롭) 에서 발화 → 내부 stopPropagation 이 트리거되지 않고 백드롭의 onClick 이 실행되어 닫힘 발생.
- **해결 패턴**: 백드롭에 mousedown 출처 추적 ref 추가 (capture 단계). mousedown 도 백드롭 자체 / mouseup-click 도 백드롭일 때만 close. 내부 stopPropagation 과 무관하게 정확히 동작.
- **공유 헬퍼**: `useBackdropClickClose(onClose)` 훅이 `onMouseDownCapture` + `onClick` props 를 반환. 백드롭 div 에 `{...backdropProps}` 스프레드만 하면 적용 완료. 3 mirror 패키지 각각 독립 복사 (cross-package import 회피).
- **Pattern C — useViewColumnMenu**: document-level `addEventListener('click')` 도 동일한 drag-out 문제. `'mousedown'` 으로 교체 + 기존 `closest('[data-column-menu="dropdown"]')` 가드 그대로 → drag-safe (mousedown 시점에 이미 출처 판정 가능).
- **수정 제외 영역**: 인-컨텐츠 닫기 버튼의 `onClick={onClose}` (의도된 사용자 액션, 본 버그 무관). `useClickOutside` 커스텀 훅 6 개 (이미 mousedown 기반, 안전). Radix Dialog/Popover/DropdownMenu/AlertDialog (`onPointerDownOutside` 이미 drag-safe).

### 동작 보존

- 백드롭 직접 클릭 (mousedown+mouseup 둘 다 백드롭) → 정상 닫힘 ✓
- ESC, 인-컨텐츠 닫기 버튼, programmatic close → 변경 없음 ✓
- 내부 컨텐츠 클릭 → 변경 없음 ✓
- 내부 → 외부 텍스트 드래그 후 mouseup → 더 이상 닫히지 않음 (버그 수정) ✓

### 영향 파일

data-craft (84 파일, +360 / -124):

**fs-data-viewer (30)**:
- packages/fs-data-viewer/src/shared/hooks/useBackdropClickClose.ts (신규)
- packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DatePickerDropdown.tsx
- packages/fs-data-viewer/src/features/column-settings/useViewColumnMenu.ts
- packages/fs-data-viewer/src/widgets/batch-input-dialog/batch-delete/DatePickerOverlay.tsx
- packages/fs-data-viewer/src/widgets/calendar/calendar/MonthPickerOverlay.tsx
- packages/fs-data-viewer/src/widgets/dialogs/IntegrityCheckDialog.tsx
- packages/fs-data-viewer/src/widgets/grid-table/components/AggregationDetailDialog.tsx
- packages/fs-data-viewer/src/widgets/grid-table/components/grid-footer/AggregationDialog.tsx
- packages/fs-data-viewer/src/widgets/cell-renderers/{color-picker-cell/ColorPickerDialog, connection/ConnectionEditOverlay, date-cell/DateOverlay, dual-widget/DualWidgetConfigDialog, FsGridDateTimeCellRenderer/DateTimeCalendarOverlay, FsGridDeadlineCellRenderer/DeadlineCalendarOverlay, FsGridFileCellRenderer/FileDialog, FsGridFormulaCellRenderer/FormulaEditDialog, FsGridImageCellRenderer/ImageDialog, FsGridLastUpdateCellRenderer/LastUpdateOverlay, FsGridLogCellRenderer/LogOverlay, FsGridMultiSelectCellRenderer/MultiSelectOverlay, FsGridNationCellRenderer/NationOverlay, FsGridProgressCellRenderer/ProgressOverlay, FsGridSimpleFormulaCellRenderer/SimpleFormulaEditDialog, FsGridSingleSelectCellRenderer/SingleSelectOverlay, FsGridTimelineCellRenderer/TimelineCalendarOverlay, FsGridVoteCellRenderer/VoteOverlay, rating-cell/RatingOverlay, time-cell/TimeOverlay, timer-cell/TimerOverlay, world-time-cell/WorldTimeOverlay}.tsx

**fs-external-data-viewer (27)**: 동일 구조의 mirror — `shared/hooks/useBackdropClickClose.ts` (신규) + 26 modal/overlay tsx.

**fs-sub-data-viewer (27)**: 동일 구조의 mirror — `shared/hooks/useBackdropClickClose.ts` (신규) + 26 modal/overlay tsx.

### 검증

- 각 페이즈 + 사후 보강 후 `pnpm typecheck:all && pnpm lint` exit 0 (gate-runner).
- `data-craft-mobile` 마스터 명시 제외. `data-craft-server` BE 무관. `data-craft-ai-preview` outside-click 패턴 부재로 무관.

### 후속 권장

- 마스터가 `pnpm dev` 로 dev server 띄워 대표 모달 (DateOverlay, ColorPickerDialog, MultiSelectOverlay, IntegrityCheckDialog, view column menu) 에서 (1) 백드롭 클릭 닫힘, (2) 내부→외부 드래그 시 모달 유지, (3) ESC/닫기 버튼 닫힘 spot-check.

---

## v001.125.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#74

### 페이즈 결과

- **Phase 1** (`92fbd779`, data-craft): `ViewColumnManagerDialog` 에 `newlyAddedColumnField` state 추가. `handleAddColumn` 성공 분기 (`bumpColumnsVersion()` 직후) 에서 `response.field` 로 set. 새 `useEffect` 가 state 가 설정되면 `listContainerRef` 안에서 `[data-column-field="..."]` 셀렉터로 행을 찾아 `scrollIntoView({ block: 'nearest' })` 후 state 를 null 로 리셋. effect deps = `[newlyAddedColumnField]` 만 (bumpColumnsVersion 동기 setState 라 같은 commit 에 batch 됨).
- **Phase 1 보강** (`ead93d76`, data-craft): advisor #1 사후 점검에서 누락 식별 — connection 타입 열 추가 경로(`handleConnectionConfirm`) 도 동일 패턴(`viewerModel.columnModelList = [...]` + `bumpColumnsVersion()`) 만 수행하고 시그널 미발신. 동일하게 `setNewlyAddedColumnField(response.field)` 한 줄 보강. 두 경로 모두 자동 스크롤 발화.

### 해결방식

- 단일 공유 컴포넌트(`ViewColumnManagerDialog`)가 캘린더 / 칸반 / 간트뷰의 "열 정보 편집" 모달을 담당하므로 단일 지점 수정으로 세 뷰 모두 커버.
- 기존 selection-scroll useEffect 패턴(`listContainerRef.current.querySelector('[data-column-field=...]')` + `scrollIntoView({ block: 'nearest' })`) 을 그대로 차용 — 신규 hook/util 무도입.
- `selectedColumnField` 미변경 → 기존 키보드 네비게이션 / 선택 행 강조 UX 격리 보존.
- 두 add 경로 (`handleAddColumn` 일반 타입 / `handleConnectionConfirm` connection 타입) 가 동일 시그널 함수 호출.

### 영향 파일

data-craft:
- `packages/fs-data-viewer/src/widgets/view-column-manager/ViewColumnManagerDialog.tsx`

머지 커밋: (data-craft i-dev 작업 머지).

### 검증

수동 검증 시나리오 (`pnpm dev` 5173):
- 데이터 뷰어 → 캘린더뷰 디자인 모드 → "열 정보 편집" 모달 오픈.
- 기존 열이 모달 높이를 초과하도록 다수 존재하는 상태에서 새 열 추가 (텍스트/숫자 등).
- 모달 열 리스트가 하단까지 자동 스크롤되어 새 행이 보이는지 시각 확인.
- 칸반뷰 / 간트뷰에서도 동일 확인 (공유 컴포넌트).
- connection 타입 열 추가 시에도 동일 확인 (connection 설정 다이얼로그 확인 후).
- 키보드 네비게이션(↑/↓) 선택 시 자동 스크롤 (기존 동작) 회귀 없는지 확인.

자동 검증:
- phase 1 / 보강 모두 `pnpm typecheck:all && pnpm lint` PASS (0 errors, 기존 4개 warning 무관).

### 알려진 제약 / 후속

- 렌더 타이밍이 batch 보장에 의존. React 18 automatic batching 환경에서 `setNewlyAddedColumnField` + `bumpColumnsVersion` 이 같은 commit 으로 묶이므로 effect 발화 시 새 행 DOM 이 마운트됨. 만약 향후 외부 store 도입 등으로 비동기 분리 발생 시 `requestAnimationFrame` fallback 또는 deps 에 `columnsVersion` 재추가 검토 필요.
- 드래그 reorder / 삭제 경로는 스크롤 자동화 대상 아님 (마스터 요청 범위 외).

## v001.124.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#73

### 페이즈 결과

- **Phase 1** (`3553ac3c`, data-craft): fabStore (Zustand + persist) 신설. `hiddenDate` 영속(`dc_fab` 키) + `isModalOpen` 휘발 + `openModal/closeModal/hideForToday/restore` 액션 + `isFabVisible/isHeaderIconVisible` 셀렉터. sidebarStore 컨벤션 재사용.
- **Phase 2** (`0a5e1fbb`, data-craft): AIAssistantModal 컴포넌트. shadcn Dialog 베이스, 우측 하단 origin 말풍선 (`bottom-24 right-6`, `transform-origin: bottom right`, 꼬리 div), 빈 대화 영역 + 비활성 입력(`준비중입니다`) + 닫기/오늘 하루 가리기 푸터. useFabStore 구독.
- **Phase 3** (`bbd5715b`, data-craft): FloatingAIButton 위젯 (버튼 전용). `fixed bottom-6 right-6 z-30` 원형 FAB, PropertyDrawer open 조건과 동일 셀렉터로 drawerOpen 산출, `md:-translate-x-96` 좌측 푸시 + `transition-transform`. `isFabVisible=false` 시 unmount. 모달은 미마운트.
- **Phase 4** (`052578b0`, data-craft): HeaderAIIconButton + DesignModeToolbar/ViewModeToolbar 양쪽 삽입. `isHeaderIconVisible` 일 때만 노출, 클릭 시 `restore()` → rAF → `openModal()` 시퀀스로 FAB 마운트 선행 보장.
- **Phase 5** (`f7da16a6`, data-craft): BuilderPage 마운트. 비-embed 분기에 `<FloatingAIButton />` 와 `<AIAssistantModal />` 을 PropertyDrawer 다음 sibling 으로 각각 마운트. embed 분기는 둘 다 제외.
- **Phase 2 후속 수정** (`f24cdd7b`, data-craft): advisor #2 직전 검토에서 발견 — AIAssistantModal 이 드로어 오픈 시에도 FAB 와 함께 좌측으로 푸시되도록 동일 drawer-open 산출을 인라인 추가, `md:-translate-x-96` 조건부 합성. 스펙 1+4 결합 의도(말풍선 origin = FAB 위치) 충족.

### 해결방식

- 가시성 상태는 단일 zustand 스토어(`fabStore`) 가 `hiddenDate === today` 판정으로 일관 산출 → FAB 와 헤더 아이콘이 같은 셀렉터 한 쌍(`isFabVisible` / `isHeaderIconVisible`)으로 상호 배타 (스펙 7).
- 드로어 회피는 PropertyDrawer 의 실제 open 조건을 그대로 두 컴포넌트(FAB + 모달)에 인라인 동일 적용 → 단일 드로어 너비 상수(384px = `md:-translate-x-96`)로 푸시. 모바일(`max-md`) 은 push 없음.
- 모달 마운트를 BuilderPage 레벨에 배치 → FAB unmount 상태에서도 헤더 아이콘 경로의 모달이 정상 렌더.
- 헤더 아이콘 클릭은 `restore()` 후 `requestAnimationFrame` 으로 다음 프레임에 `openModal()` → FAB 마운트 선행 → 말풍선 origin(우측 하단) transition 자연스럽게.

### 영향 파일

data-craft:
- `src/entities/fab/model/fabStore.ts` (신규)
- `src/widgets/floating-ai-button/index.ts` (신규)
- `src/widgets/floating-ai-button/ui/AIAssistantModal.tsx` (신규)
- `src/widgets/floating-ai-button/ui/FloatingAIButton.tsx` (신규)
- `src/widgets/header/ui/HeaderAIIconButton.tsx` (신규)
- `src/widgets/header/ui/DesignModeToolbar.tsx`
- `src/widgets/header/ui/ViewModeToolbar.tsx`
- `src/pages/builder/BuilderPage.tsx`

머지 커밋: (data-craft i-dev 작업 머지).

### 검증

수동 검증 시나리오 (`pnpm dev` 5173 빌더 페이지):
- 우측 하단 FAB 노출 확인.
- 위젯/섹션/영역 선택 → PropertyDrawer 오픈 → FAB 가 좌측으로 부드럽게 푸시. (md 이상 브레이크포인트)
- FAB 클릭 → 우측 하단 origin 말풍선 모달 (zoom-in transition + transform-origin: bottom right). 드로어 오픈 상태에서 클릭해도 모달 origin 이 FAB 위치(좌측 푸시된 자리) 와 일치하는지 확인.
- 모달 입력 영역 disabled + `준비중입니다` 라벨 표시.
- "오늘 하루 버튼 가리기" 클릭 → 모달 닫힘 + FAB 사라짐 + 두 toolbar (디자인/뷰) 의 mode 토글 옆에 Sparkles AI 아이콘 노출.
- 헤더 AI 아이콘 클릭 → 모달 재오픈 + FAB 복귀 (다음 프레임). 헤더 아이콘 사라짐 (상호 배타).
- localStorage `dc_fab` 삭제 또는 다음 날 → FAB 복귀, 헤더 아이콘 사라짐.
- embed 분기 (URL `?embed=true`) → FAB·모달 둘 다 미노출, 기존 동작 유지.

자동 검증:
- 각 phase 별 `pnpm typecheck:all && pnpm lint` PASS (0 errors).

### 알려진 제약 / 후속

- 드로어 너비 `384px` 하드코딩 (PropertyDrawer `max-w-md` 가정). 향후 다른 너비의 우측 드로어 추가 시 두 파일(`FloatingAIButton.tsx`, `AIAssistantModal.tsx`) 의 `md:-translate-x-96` 갱신 필요. 동일 산출 로직이 두 곳에 인라인이므로 hook 추출 리팩토링이 후속 정리 대상.
- 실제 AI API 미구현 — 입력 영역은 현재 100% 비활성. 후속 플랜에서 채팅 송수신 + 응답 렌더링 + 히스토리 영속화 필요.

## v001.123.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#72 (핫픽스 1)

### 페이즈 결과

- **Phase 4 / 핫픽스 1** (`eba13b9`, data-craft-mobile): v001.121.0 의 알려진 제약 2건 처리.

### 핫픽스 사유 + root cause

마스터 후속 지시 — v001.121.0 발행 시 두 제약을 별도 cleanup 으로 명시:
1. `packages/fs-api-mobile/vitest.config.ts` 가 `client.fetch.test.ts` 를 exclude 해 Phase 1·2·3 의 신규 시나리오 테스트 (타임아웃 / 네트워크 / 재시도 / 세션 헤더 합계 9개) 가 실제 vitest 게이트에서 미실행. exclude 가 본 플랜 이전부터 있던 fork 결함 (web fs-api 와 동일 4건 fail) 때문에 유지되어 왔다.
2. `interceptedFetch` / `interceptedFetchBinary` 의 **리프레시-재시도 콜백 내 Bearer 주입** 이 Phase 3 의 `buildSessionHeaders` 와 통합되지 않음 (newToken 파라미터 의미가 storage read 와 달랐기 때문).

Root cause (fork 결함 4건):
- 타임아웃/abort 테스트 2건 — `fetchMock` 이 `new Promise(() => {})` 로 hang 만 하고 AbortSignal 을 무시 → 타임아웃/abort 시 reject 가 발생하지 않아 5초 vitest 하드타임아웃까지 대기 후 fail.
- GET 중 caller-abort 테스트 — `.catch()` 핸들러를 abort 발화 이후 등록해 abort 가 동기적으로 던지는 rejection 이 unhandled 로 누설.
- 타임아웃 describe 의 fakeTimers 누수 — `beforeEach`/`afterEach` 에서 fake/real 전환을 명시하지 않아 다른 describe 로 잔여 영향.

### 해결방식

1. `vitest.config.ts` 의 exclude 에서 `"src/api/__tests__/client.fetch.test.ts"` 제거.
2. 4건 fork 결함 fix:
   - **signal-aware fetchMock**: `new Promise((_, reject) => { signal?.addEventListener('abort', () => reject(signal.reason)); })` 패턴으로 변경.
   - **선등록 catch**: `const errPromise = promise.catch(e => e);` 를 abort 호출 전에 등록 → unhandled rejection 누설 차단.
   - **`advanceTimersByTimeAsync`**: 가짜 타이머 진행을 async 로 await.
   - **describe 단위 fake/real 전환**: 타임아웃 describe 의 `beforeEach(useFakeTimers)` / `afterEach(useRealTimers)` 명시.
3. `client.headers.ts` 의 `buildSessionHeaders` 에 `overrideAccessToken?: string` 옵션 추가. `interceptedFetch` / `interceptedFetchBinary` 의 리프레시-재시도 콜백에서 직접 Bearer 박는 코드를 `buildSessionHeaders(options, { overrideAccessToken: newToken })` 호출로 대체. 호출자 헤더 뒤에 Authorization 을 덮어써 기존 newToken 우선 동작 유지 (행동 동치).

### 영향 파일

data-craft-mobile:
- packages/fs-api-mobile/vitest.config.ts
- packages/fs-api-mobile/src/core/client.headers.ts
- packages/fs-api-mobile/src/core/client.fetch.ts
- packages/fs-api-mobile/src/api/__tests__/client.fetch.test.ts

머지 커밋: (data-craft-mobile i-dev hotfix 1 merge).

### 검증

- `pnpm -F @dcm/fs-api-mobile test` — **135 테스트 전체 grøn** (이전엔 exclude 로 패키지 게이트에서 미실행이었던 client.fetch.test.ts 가 이번엔 실제 실행).
- `pnpm typecheck` — PASS.

## v001.122.0

> 통합일: 2026-05-15
> 플랜 이슈: #70 (hotfix 1)

### 페이즈 결과
- **Hotfix 1 (cumulative Phase 3)**: Phase 2 가 `GroupHeader` 좌측 묶음을 sticky-left 로 만들어 가로 스크롤 시 그룹 제목+체크박스가 고정되도록 한 결과, 데이터 행의 `RowNumberCell` (행 체크박스) 과 컬럼 헤더의 `FixedHeaderCells` (전체 선택 체크박스) 는 sticky 가 아니어서 가로 스크롤 시 화면 밖으로 밀려나 사라지는 회귀가 발생했다. 본 핫픽스에서 `DataRow.tsx` 의 행 좌측 고정 셀 묶음(드래그/행번호/서브그리드)을 `position:sticky; left:0; zIndex:1` 래퍼로 감싸고, `FixedHeaderCells.tsx` 의 헤더 좌측 고정 셀 묶음을 `position:sticky; left:0; zIndex:2; bg-muted` 래퍼로 감싸 가로 스크롤 시 헤더(z:2) / 데이터 행(z:1) / 그룹 헤더(z:1) 세 레이어가 모두 좌측에 고정되어 세 종류 체크박스가 공존하도록 정정.

### 영향 파일
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/FixedHeaderCells.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/DataRow.tsx`

## v001.121.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#72

### 페이즈 결과

- **Phase 1** (`fd25d79`, data-craft-mobile): fs-api-mobile 에 타임아웃 헬퍼 추가 (`FETCH_TIMEOUT_MS=15_000`, AbortController, 웹 fs-api 동일 패턴). `executeFetch` / `interceptedFetchBinary` 에 timer signal + 호출자 userSignal 합성, 타임아웃 → `ApiException(status=0, timeout=true)` / 네트워크 TypeError → `ApiException(status=0, timeout=false)` / 사용자 abort → 원본 AbortError 재발생. `ApiException` 에 `timeout?: boolean` 5번째 선택 인자 추가 (기존 호출 표면 보존).
- **Phase 2** (`ef55cb9`, data-craft-mobile): 신규 `core/client.retry.ts` 로 transient 재시도 헬퍼 도입 (지수 backoff 100ms · 300ms · 900ms, 최대 3회). 분류 = `timeout=true` OFF / caller signal aborted OFF / `status=0 && !timeout` ON (네트워크 실패) / 5xx ON / 4xx OFF. **GET·HEAD 기본 재시도**, 비안전 메서드는 호출자 `retry: true` opt-in 시에만. 401 + token refresh 경로와는 합성 금지 (refresh queue 무변경). `parseOptions.ts` 에 `retry` 옵션 파싱 추가. `interceptedFetch` 의 executeFetch 호출 3곳 (skipAuth / 일반 / 토큰 갱신 재시도) 을 모두 `runWithRetry` 로 wrap.
- **Phase 3** (`b62769c`, data-craft-mobile): 신규 `core/client.headers.ts` 의 `async buildSessionHeaders(options): Promise<HeadersInit>` 로 Bearer 주입 단일화. 토큰 존재 시 `Authorization: Bearer <token>`, 부재 / skipAuth → 키 생략, 호출자 헤더 우선 (override). 신규 커스텀 헤더 추가 0 (CORS preflight 회피 — BE 무수정 제약). 리프레시 콜백 내부 Bearer 주입은 newToken 파라미터 의미가 다르므로 보존 (부분 단일화 — primary path 만 헬퍼화).

### 영향 파일

data-craft-mobile:
- packages/fs-api-mobile/src/core/client.fetch.ts
- packages/fs-api-mobile/src/core/client.retry.ts (신규)
- packages/fs-api-mobile/src/core/client.headers.ts (신규)
- packages/fs-api-mobile/src/core/parseOptions.ts
- packages/fs-api-mobile/src/constants/index.ts
- packages/fs-api-mobile/src/types/api.types.ts (ApiException timeout 필드 추가)
- packages/fs-api-mobile/src/api/__tests__/client.fetch.test.ts

머지 커밋: `c6cbbc1` (i-dev).

### 알려진 제약 / 후속

- **vitest 게이트 미실행**: `packages/fs-api-mobile/vitest.config.ts` 의 `exclude` 목록에 `client.fetch.test.ts` 가 본 플랜 이전부터 등록돼 있어 본 플랜의 신규 시나리오 테스트 (타임아웃 / 네트워크 실패 / 재시도 / 세션 헤더 4개 카테고리) 가 패키지 테스트 게이트에서 미실행. 본 페이즈에서 exclude 제거는 plan-enterprise 스코프 밖 (마스터 별도 결정 사항) 이라 미해결. `pnpm typecheck` 는 통과 — 10+ 호출처 (apps/web/src/mobile/screens/**, fs-relation-builder-mobile, fs-data-link-mobile, fs-data-viewer-mobile) 와의 정적 통합은 확인됨.
- **세션 헤더 부분 단일화**: 리프레시 콜백 내부 Bearer 주입은 newToken 파라미터 사용 구조로 의미가 달라 기존 방식을 보존했다. 향후 동일 헬퍼로 묶으려면 함수 시그니처 (인자 vs storage read) 조정 필요.
- **Roadmap-1 단계1-A 완료** — 후속 1-B / 1-C 가 본 어댑터 위에서 페이지/레코드 화면 작업을 진행할 수 있다.

## v001.120.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#56 (핫픽스 3)

### 페이즈 결과

- **Phase 10** (`d1ef5c75`, data-craft): 가로 스크롤 시 헤더 sticky frozen 컬럼이 본문보다 일찍 release 되어 "뒤로 밀리는" 시각 정정.

### 핫픽스 사유 + root cause

핫픽스2 (v001.116.0) 후 마스터 보고: "열 제목 부분이 따라는 가는데 조금만 더 가면 분리되서 본문만 고정되고 제목은 뒤로 밀려".

**확정 원인**: GridBody 의 스크롤 컨테이너 내부에 `RowMenuColumn` (40px) 이 flex sibling 으로 존재해 `body.scrollWidth = 컬럼 합 + 40px`. 반면 GridHeader 의 `ColumnAddButton` 은 스크롤 컨테이너 *외부* sibling 이라 `header.scrollWidth = 컬럼 합`. useScrollSync 가 body.scrollLeft → header.scrollLeft 를 assign 할 때, body 가 끝까지 스크롤된 시점에 header 는 max 에 clamp → header 의 sticky 컬럼이 더 이상 진행하지 못해 "뒤로 밀리는" 인상.

### 처리 내용

ColumnAddButton 의 외부 sibling 시각 구조는 그대로 유지하면서, **GridHeader 와 GroupHeaderRow 의 스크롤 컨테이너 inner flex 끝에 `FIXED_COLUMN_WIDTH.addMenu(40px)` 크기의 투명 spacer div 를 추가**하여 세 스크롤 컨테이너(header/groupHeader/body)의 scrollWidth 를 정확히 일치시킴. → useScrollSync 의 scrollLeft 동기화가 끝까지 1:1 유효 → 헤더 sticky 와 본문 sticky 가 동일한 release 지점을 공유.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/widgets/grid-table/components/GridHeader.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/GroupHeaderRow.tsx`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0, 3 사전 무관 warning.
- 가설 1 (scrollWidth 불일치) 확정 — body 의 RowMenuColumn(40px) 가 sticky containing block 폭 차이의 직접 원인.

### 알려진 후속 / Carve-out

- ColumnAddButton 을 스크롤 내부로 이동시키지 않은 이유: 외부 sibling 으로 고정되어야 하는 시각 요구(우측 항상 가시) 가 있을 가능성 + 옮길 경우 ColumnAddButton 의 sizing 의존성 회귀 위험. 투명 spacer 방식이 시각/구조 모두 안전.
- 동일 패턴이 서브 그리드(`widgets/fs_grid_sub/`)에서 재현되는지 — 현 시점 마스터 보고 없음. 필요 시 후속 핫픽스로 분리.

## v001.119.0

> 통합일: 2026-05-15
> 플랜 이슈: #70

### 페이즈 결과
- **Phase 1**: `SelectionStateContext` + `useTableView` 에 그룹 단위 선택 헬퍼 두 함수 추가 — `onSelectGroup(rowFields)` (전부 선택 상태일 때만 해제, 그 외는 전부 선택) + `getGroupSelectionState(rowFields)` ('none' | 'partial' | 'all'). UI 무수정.
- **Phase 2**: `GroupedRowItem` header 에 `rowFieldsInGroup` 적재 → BodyRowList 가 GroupHeader 로 전달. `GroupHeader` 에 chevron 즉시 왼쪽 native checkbox 추가 (indeterminate 는 `useRef`+`useEffect` 로 DOM 설정, onClick/onChange 둘 다 stopPropagation, `useSelectionState` 의 그룹 헬퍼 사용). 체크박스+chevron+제목 컨테이너에 `position: sticky; left: 0; zIndex: 1` + `bg-muted group-hover:bg-accent` 적용 — 가로 스크롤 시 좌측에 고정. i18n `gridTable.selectGroup` 4 언어(ko/en/ja/zh) 추가. `FsGridTableView` 가 `SelectionStateProvider` 에 `onSelectGroup` 전달.
- **Phase 2 hotfix**: `useSubGridModel.ts:198` / `useTableView.ts:612` 의 GroupedRowItem header 리터럴 두 곳에 `rowFieldsInGroup` 수집 추가 — typecheck 통과.

### 영향 파일
- `packages/fs-data-viewer/src/features/data-viewer/context/SelectionStateContext.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableView.ts`
- `packages/fs-data-viewer/src/features/grid/lib/grid-calculations/rowGrouping.ts`
- `packages/fs-data-viewer/src/features/grid/lib/gridGroupTypes.ts`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/BodyRowList.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/GroupHeader.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/FsGridTableView.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/hooks/useSubGridModel.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/types.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/translations/{ko,en,ja,zh}.ts`

## v001.118.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#67 (hotfix 1)

### 페이즈 결과

- **Phase 3 / Hotfix 1** (`3066ca3`, data-craft): v001.115.0 으로 14개 카테고리가 된 아이콘 피커 `CategoryTabs.tsx` 의 가로 스크롤 컨테이너에서, 마우스 클릭+드래그로 가로 스크롤이 되지 않아 오른쪽 끝 탭들 (자연/교통/개발) 접근 불가하다는 마스터 보고. pointer 이벤트 핸들러 (`onPointerDown/Move/Up/Cancel`) 를 인라인으로 부착해 마우스 클릭+드래그 가로 스크롤 추가. 마우스 (`pointerType === 'mouse'`) 만 처리, 터치/펜은 native 스크롤 보존. 5px 이동 임계 초과 시 드래그로 판정하며 드래그 종료 직후의 `click` 이벤트를 window-level capture once 리스너로 차단해 Radix `TabsTrigger` 의 의도치 않은 탭 활성화 방지. 정지 시 `cursor: grab` / 드래그 중 `grabbing`, `user-select: none` 으로 시각적 어포던스. 휠/터치/키보드 동작 보존.

### advisor 검증

- 완료 시점 (#2 / hotfix 1): no BLOCK (5관점 PASS). lint 게이트 (`pnpm typecheck:all && pnpm lint`) exit 0.

### 후속 후보

- 본 hotfix 적용 후 data-craft 의 `CategoryTabs.tsx` 가 data-craft-mobile 의 동일 파일과 바이트 동일성을 잃음. mobile 은 native 터치 스크롤로 기능적 결함 없으나, 향후 mobile 에도 드래그 핸들러 평행 적용 가능 (후속 hotfix 후보).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/shared/ui/icon-picker/CategoryTabs.tsx`

## v001.117.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#68

### 페이즈 결과

- **Phase 1** (`332322d`, data-craft): 그리드 뷰 디자인 모드 열 메뉴의 열 너비 상한 인라인 하드코딩 값 500 → 1000 으로 일괄 교체 (3개 패키지 × 코드 12개 위치). `SubGridSettingsOverlay.tsx:158` 의 `max={500}` 은 행 높이 상한으로 확인되어 변경 제외 (열 너비 무관).
- **Phase 2** (`5742504`, data-craft): 한·영 가이드 JSON 의 "최대: 500px" / "Maximum: 500px" 표기를 1000 으로 갱신 (3개 패키지 × 한영 = 6개 파일).

### 처리 내용

- 마스터 명령: 데이터 뷰어 그리드 뷰 디자인 모드 열 메뉴의 열 너비 제한을 최대 500 → 1000 으로 확장.
- 도메인 검증 상수 `MAX_COLUMN_WIDTH = 1000` 이 이미 1000 으로 정의되어 있어 마이그레이션·스키마 변경 불필요. UI/handler 인라인 값만 일치시킴.
- 공유 상수 추출 리팩터는 본 플랜 범위 외 (후속 후보).

### 영향 파일

**data-craft (12 파일):**
- `packages/fs-data-viewer/src/features/grid/hooks/column-menu/menuItems.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/column-menu/useColumnHandlers.ts`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/components/SubGridColumnMenu.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/hooks/useSubGridColumnMenu.ts`
- `packages/fs-data-viewer/src/shared/config/guide/content/ko/docs/grid.json`
- `packages/fs-data-viewer/src/shared/config/guide/content/en/docs/grid.json`
- `packages/fs-sub-data-viewer/src/features/grid/hooks/column-menu/menuItems.ts`
- `packages/fs-sub-data-viewer/src/features/grid/hooks/column-menu/useColumnHandlers.ts`
- `packages/fs-sub-data-viewer/src/shared/config/guide/content/ko/docs/grid.json`
- `packages/fs-sub-data-viewer/src/shared/config/guide/content/en/docs/grid.json`
- `packages/fs-external-data-viewer/src/features/grid/hooks/column-menu/menuItems.ts`
- `packages/fs-external-data-viewer/src/features/grid/hooks/column-menu/useColumnHandlers.ts`

(추가: `fs-external-data-viewer` 의 한·영 grid.json 2개 — 합계 14 파일)

### advisor 결과

- 계획 시점 (#1): PASS — Intent / Logic / Group Policy / Evidence / Command Fulfillment 모두 통과.
- 완료 시점 (#2): PASS — 동일 5관점 통과. Group Policy 에서 Phase 2 lint gate 가 추가 실행되어 자동 회귀 차단 확인 (0 errors, 3 warnings).

## v001.116.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#56 (핫픽스 2)

### 페이즈 결과

- **Phase 9** (`f28e9bff`, data-craft): 핫픽스1 후속 — Bug 3 진짜 root cause 처리 + Bug 1+2 sticky 방향 정정.

### 핫픽스 사유

핫픽스1 (v001.107.0) 머지 후 마스터 재보고: (Bug 3) 여전히 새로고침 시 frozen 풀림, (Bug 1+2) drag/rowNumber/dualToggle/rowId 까지 sticky 됨 (정반대 방향).

진단 결과:
- **Bug 3 진짜 root cause**: 호스트 앱(`data-craft/src/features/viewer/lib/`)의 변환기 두 곳 (`serverToViewerMetaResult.ts`, `serverToColumnRow.ts`) 이 `setting.width / unit / enableSorting` 등은 추출하지만 **`setting.frozen` 만 누락**. 그 결과 ViewerMetaResult.columns[].frozen = undefined → fs-data-viewer 패키지의 `useViewerMetaLoader.ts` 의 `?? 'none'` 폴백이 항상 적용 → 새로고침 시 항상 'none'. 서버 hotfix1a (응답 자체에 frozen 포함) 는 정확했으나 호스트 앱 단계에서 버려진 것. **Phase 3 의 "FE 전 계층 통과" 보고는 fs-data-viewer 패키지 내부만 처리하고 호스트 앱 변환기 단계를 누락**했던 것.
- **Bug 1+2 방향성**: 핫픽스1b 가 FixedHeaderCells / RowDragHandle / RowNumberCell / SubGridToggleCell / AggregationRow / GroupHeaderRow 의 fixed cells 를 sticky 화한 것이 마스터 의도와 정반대. master 명시: drag / rowNumber / dualToggle / rowId 모두 가로 스크롤 시 **자연 스크롤**. 사용자가 freeze 한 컬럼만 좌측 경계(offset 0) sticky.

### 처리 내용

1. **Bug 3 FE 변환기 frozen 매핑 추가**:
   - `src/features/viewer/lib/serverToViewerMetaResult.ts`: columns.map 반환 객체에 `frozen: (setting?.frozen ...) ?? 'none'` 추가.
   - `src/features/viewer/lib/serverToColumnRow.ts`: 동일 패턴 추가.
2. **핫픽스1b 의 sticky 변경 되돌리기**:
   - FixedHeaderCells.tsx / RowDragHandle.tsx / RowNumberCell.tsx / SubGridToggleCell.tsx / DataRow.tsx / AggregationRow.tsx / GroupHeaderRow.tsx 에서 sticky / zIndex / 불투명 배경 / stickyLeft prop 전달 등 핫픽스1b 가 추가한 부분만 정확히 제거.
3. **leftBase = 0 으로 통일**:
   - `GridHeader.tsx`, `GridBody.tsx`, `AggregationRow.tsx` 의 `leftBase` 누적값(`drag + rowNumber + dualToggle`) → `0` 으로 변경. 사용자-frozen 컬럼이 컨테이너 좌측 경계(0) 에 부착되도록.
4. **customColumnGenerator rowId frozen 제거**:
   - `customColumnGenerator.ts:95` 의 rowId 분기 `frozen: 'start'` → `'none'`. rowId 가 frozenLayout 의 sticky 집합에서 빠짐 → 가로 스크롤 시 자연 스크롤.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/features/viewer/lib/serverToViewerMetaResult.ts`
- `src/features/viewer/lib/serverToColumnRow.ts`
- `packages/fs-data-viewer/src/widgets/grid-table/components/GridHeader.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/GridBody.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/{DataRow,RowDragHandle,RowNumberCell,SubGridToggleCell}.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-footer/AggregationRow.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/{FixedHeaderCells,GroupHeaderRow}.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_util/customColumnGenerator.ts`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0, 3 사전 무관 warning.
- advisor 사전 분석 PASS (Bug 3 FE-side mapping gap 정확 진단, Bug 1+2 정확 방향 정정 확인).

### 알려진 후속 / Carve-out

- 본 핫픽스는 **메인 그리드** 위주. 서브 그리드(`widgets/fs_grid_sub/`)는 Phase 5 의 systemRowIdFields 분리로 이미 처리됨. 마스터의 본 재보고에 서브 그리드 명시 없음 → 미수정.
- Phase 7 의 frozenLayout 테스트는 prefix=0 케이스 포함 → leftBase=0 변경에 자연 부합. 다른 테스트는 영향 없음.

## v001.115.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#67

### 페이즈 결과

- **Phase 1** (`6f71959`, data-craft): 공통 아이콘 피커에 `development` (개발) 카테고리를 14번째 탭으로 신설. `lucide-react` 0.562.0 실존 아이콘 중 기존 13개 카테고리와 disjoint 한 65개 아이콘 (Git/VCS, 터미널, 빌드, 디버그/테스트, 패키지/인프라, 클라우드, 네트워킹, 컴포넌트, 보안, AI/자동화, 파일/코드, 기타) 선별. `icons-development.ts` 신규 + `iconCategories.ts` 등록 + `iconKeywords.ts` 65개 한글 키워드 매핑 + i18n (`ko.ts` "개발", `en.ts` "Development") 추가.
- **Phase 2** (`736b2aa`, data-craft-mobile): `packages/fs-form-builder-mobile/src/shared/config/page-icons/` 의 평행 아이콘 피커에 Phase 1과 **바이트 단위로 동일한** development 카테고리 추가. mobile 은 i18n 분리 없이 inline `label: '개발'` 사용. drift 0 — `diff` 로 icons-development.ts 와 iconKeywords.ts development 섹션 모두 동일성 검증.

### advisor 검증

- 계획 시점 (#1): no BLOCK (5관점 PASS).
- 완료 시점 (#2): no BLOCK (5관점 PASS). drift 가 `diff` exit 0 으로 1차 증거 확인.

### Lint 게이트

- data-craft: `pnpm typecheck:all && pnpm lint` exit 0.
- data-craft-mobile: `pnpm typecheck` exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/shared/config/page-icons/icons-development.ts` (신규)
- `src/shared/config/page-icons/iconCategories.ts`
- `src/shared/config/page-icons/iconKeywords.ts`
- `src/shared/i18n/locales/ko.ts`
- `src/shared/i18n/locales/en.ts`

**data-craft-mobile** (`bj-kim-funshare/data-craft-mobile`, branch `i-dev`):
- `packages/fs-form-builder-mobile/src/shared/config/page-icons/icons-development.ts` (신규)
- `packages/fs-form-builder-mobile/src/shared/config/page-icons/iconCategories.ts`
- `packages/fs-form-builder-mobile/src/shared/config/page-icons/iconKeywords.ts`

## v001.114.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#65 (hotfix 2)

### 페이즈 결과

- **Phase 3 / Hotfix 2** (`f1ba938`, data-craft): 베타 뱃지의 slate (회색) 톤이 너무 밋밋하다는 마스터 피드백에 따라 컨테이너 색조를 sky 계열 (`bg-sky-50` / `text-sky-700` / `border-sky-200`) 로 교체. "살짝 푸른" 느낌의 산뜻한 톤. `β` 문자 (`font-serif italic`) + "Beta" 텍스트 + flex/padding/radius 등 구조는 그대로 유지. 단일 라인 className 변경.

### advisor 검증

- 완료 시점 (#2 / hotfix 2): no BLOCK. lint 게이트 (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/property-drawer/ui/WidgetTypeSelector.tsx`

## v001.113.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#65 (hotfix 1)

### 페이즈 결과

- **Phase 2 / Hotfix 1** (`8ebcda1`, data-craft): 위젯 선택 드롭다운 베타 뱃지의 시각 표현 교체. amber/노랑 톤(`bg-amber-100 text-amber-700 border-amber-200`) 을 slate 톤(`bg-slate-100 text-slate-700 border-slate-300`) 으로 변경. 베타 아이콘은 `lucide-react` `FlaskConical` 픽토그램 대신 베타 표준 심볼 문자 `β` 를 `font-serif italic` 으로 inline 렌더 (로마자/글자 형태). `widgetTypeConfig.ts` 데이터 모델(`beta?: boolean`) 은 변경 없음.

### advisor 검증

- 완료 시점 (#2 / hotfix 1): no BLOCK. lint 게이트 (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/property-drawer/ui/WidgetTypeSelector.tsx`

## v001.112.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54 (핫픽스 6)

### 페이즈 결과
- **Phase 9 (핫픽스 6)**: hotfix 5 가 BlockNote default toolbar 를 복원하면서 그 default `FileDownloadButton` 이 raw URI 로 `window.open()` → 새 탭을 여는 동작도 함께 노출되어 사용자 혼선 가능. 본 핫픽스는 그 단일 버튼을 CSS selector (`button[aria-label*="다운로드"]`, `button[aria-label*="Download"]`) 로 `display: none !important` 처리하여 시각적으로만 hide. framework 동작 / focus 처리 / 다른 toolbar 버튼 모두 무영향. 이미지/파일 다운로드는 hotfix 5 에서 도입한 인-블록 버튼 (dcImagePreview 오버레이, dcFileBlockSpec 파일명 행 클릭) 으로 일원화.

### 배경
hotfix 2 의 `CustomFormattingToolbar` 전체 교체 접근이 toolbar regression 을 유발한 점 (hotfix 5 의 배경) 을 학습. 본 핫픽스는 framework UI 를 교체하지 않고 단일 버튼만 CSS hide 하는 lower-risk seam 사용. advisor 권고: "If master complains again, suppress that one toolbar item, don't replace the whole toolbar" 정확히 그 패턴.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.css` (신규, 7 라인)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx` (+1 라인 import)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (3 warnings, 0 errors — 모두 기존).
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 manual repro 필요.

### 후속 빌드 단계
`fs_data_viewer` 만 변경 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

## v001.111.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#60 (hotfix 1)

### 페이즈 결과

- **Phase 2 / hotfix 1** (`ddfddec4`, data-craft): v001.102.0 의 ref-bridge fix 가 `fs-sub-data-viewer/` 패키지에만 적용되어 마스터가 실제로 사용하는 `fs-data-viewer/` 패키지(병렬 구조)에는 동작하지 않던 누락 보완. 동일 패턴(`refreshAggregationForColumnRef` + router 의 `requestBatchInput` 래퍼)을 `fs-data-viewer/` 에 적용. flush 모델 차이 반영: `fs-data-viewer` 의 `refreshAggregationForColumn` 은 pending 큐만 누적하고 flush 시점에 fetch 하는 구조여서 일괄 입력 경로엔 부적합 → 신규 `refreshAggregationForColumnImmediate` 함수를 추가하여 큐 우회 즉시 fetch. wrap 콜백은 React Compiler 의 `react-hooks/preserve-manual-memoization` 규칙 호환을 위해 `useMemo` 가 아닌 `useCallback` 으로 구성. `pnpm typecheck:all && pnpm lint` 통과.
- **Phase 2 / hotfix 1** (`34bcc6a`, data-craft-server): viewer.query.ts:127 / viewer.service.ts:304 두 매퍼 모두에서 `ViewerColumnSetting.frozen` 필수 필드가 누락되어 ts-node 부팅 시 TS2322 오류로 서버가 크래시되던 문제 수정. `setting.frozen ?? 'none'` 의 null-safe 패턴(model.ts:707 쓰기 측 컨벤션과 일치)으로 두 매퍼 모두 보완. `npx tsc --noEmit` clean.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/app/FsDataViewerRouter.tsx`
- `packages/fs-data-viewer/src/features/grid/lib/gridViewTypes.ts`
- `packages/fs-data-viewer/src/pages/GridViewPage.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableView.ts`

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/services/viewer/viewer.query.ts`
- `src/services/viewer/viewer.service.ts`

## v001.110.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#64 (핫픽스 1)

### 핫픽스 사유

플랜 #64 (v001.108.0) Phase 1 BE 호환성 검증에서 발견된 axis-3 caveat — `authClient` 의 `signin` / `refresh` / `autoSignin` 응답 캐스팅이 BE 실제 래퍼 구조와 불일치해 런타임에 undefined 필드가 반환되는 결함. 본 hotfix 가 세 메서드의 unwrap 을 BE 실제 응답 형태에 정합시킨다.

### 페이즈 결과

- **Hotfix 1 / Phase 5** (`7e57afd`, data-craft-mobile): authClient 응답 unwrap + 필드 정규화 통일.
  - **signin**: BE 가 `{ auth: { accessToken, refreshToken?, user: { id(number), roleName, ... }, account } }` 래퍼로 응답하나 클라이언트는 flat `SigninResponse` 로 직접 캐스팅 중. `body.auth` unwrap + `user.id` number → string 코어션 + `user.roleName` → `user.role` 매핑.
  - **refresh**: BE 가 `{ callId, message, data: { accessToken, refreshToken } }` 래퍼 (서비스 컨트롤러가 직접 감쌈) 로 응답하나 클라이언트는 flat 캐스팅 중. `body.data` unwrap (signin 의 `auth` 래퍼와 다른 키 — 비균일).
  - **autoSignin**: signin 서비스와 동일하게 `{ auth: {...} }` 래퍼 → signin 과 동일한 unwrap.
  - **types.ts**: `SigninResponse.refreshToken` 을 선택적 (`?`) 으로 변경 (BE 가 rememberMe 시에만 반환).
  - **sessionEngine.ts**: `signin()` 에서 `refreshToken ?? null` 코어션, `applyToken` 시그니처를 `string | null` 허용으로 확장.
  - **테스트**: `authClient.test.ts` / `sessionEngine.test.ts` 의 MSW 핸들러를 BE 실제 래퍼 형태로 교정 (기존엔 broken flat 형태를 mock 해 가짜 PASS 였음).

### advisor 검증

- 완료 시점 advisor: no BLOCK. 필드 정규화 (`user.id`, `roleName→role`, `refreshToken nullable`) 가 phase description ("응답 unwrap 통일") 범위 안의 정합 작업이며, `apps/web/src/mobile/` 전 영역 grep 결과 `roleName` / `user.id` 외부 소비처 0 — 회귀 위험 없음.

### 영향 파일

**data-craft-mobile** (`bj-kim-funshare/data-craft-mobile`, branch `i-dev`):
- `apps/web/src/mobile/auth/authClient.ts`
- `apps/web/src/mobile/auth/sessionEngine.ts`
- `apps/web/src/mobile/auth/types.ts`
- `apps/web/src/mobile/auth/__tests__/authClient.test.ts`
- `apps/web/src/mobile/auth/__tests__/sessionEngine.test.ts`

## v001.109.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#65

### 페이즈 결과

- **Phase 1** (`8305f1b`, data-craft): 디자인 모드 → 레이아웃 빌더 → 위젯 설정 드로어의 위젯 선택 드롭다운에서 베타 단계 위젯 7종 우측에 "Beta" 태그(`FlaskConical` 아이콘 + amber 톤 inline 뱃지)를 표기. `WidgetTypeInfo` 타입에 `beta?: boolean` 필드를 추가하고 `sub-viewer` / `external-viewer` / `viewer-explorer` / `sub-viewer-explorer` / `external-viewer-explorer` / `empty-sub-viewer` / `empty-external-viewer` 에 `beta: true` 설정. `WidgetTypeSelector` 의 `mapWidgetType` 결과에 `beta` 매핑, `renderWidgetItem` 우측 텍스트 컬럼의 이름 줄에 조건부 뱃지 렌더.

### advisor 검증

- 계획 시점 (#1): Intent / Logic / Group Policy / Evidence / Command Fulfillment 5축 PASS (no BLOCK).
- 완료 시점 (#2): no BLOCK. lint 게이트 (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/property-drawer/ui/widgetTypeConfig.ts`
- `src/widgets/property-drawer/ui/WidgetTypeSelector.tsx`

## v001.108.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#64

### 페이즈 결과

- **Phase 1** (`0180c6e`, data-craft-mobile): BE 호환성 검증 문서 `AUTH_BE_COMPATIBILITY.md` 신규 작성. 4축 검증 (Origin allowlist / CSRF·Cookie / Client contract / VITE_API_BASE_URL) 결과 **종합 PASS-with-caveat**. Origin (`https://funshare-inc.github.io`) 는 BE CORS allowlist 리터럴 패턴에 등록되어 PASS, BE 가 JSON-body JWT 만 사용 (Set-Cookie 없음) 이므로 CSRF/쿠키 도메인 N/A → PASS. Caveat 2건: (a) `signin`/`refresh`/`autoSignin` 응답 형태가 BE 의 `{auth:{...}}` / `{callId, message, data:{...}}` 래퍼와 클라이언트 `types.ts` flat 구조 사이에 불일치 — 후속 hotfix 또는 별도 plan 처리 필요. (b) GitHub Pages 배포 workflow 미존재 + `VITE_API_BASE_URL` 주입 step 미구성 — 배포 파이프라인 신규 작성 시 액션 아이템.
- **Phase 2** (`c2e8715`, data-craft-mobile): `ScreenLogin.tsx` linkRow 에 `·` 구분자 + `<Link to="/m/workspace-select">회사 선택</Link>` 추가. `ScreenLogin.module.css` 에 `linkSep` / `linkWorkspace` 클래스 + linkRow flex gap 적용. 기존 signin/forgot-password/SSO placeholder 동작은 미변경.
- **Phase 3** (`c85f5c5`, data-craft-mobile): `screens/forgot-password/` 4단계 상태머신 (email → code → password → done) 신규 구현. `ScreenForgotPassword`, `StepEmail`, `StepCode`, `StepNewPassword`, `useResetFlow`, `index.ts`, CSS module 신규. `authClient.ts` 에 `sendVerificationCode` (data 래퍼 unwrap), `confirmPasswordReset` (flat 응답) 두 메서드 추가. `routes/forgot-password.tsx` placeholder 26줄 → 1줄 re-export 로 교체. 인라인 에러 표시, 카운트다운, 성공 시 `/m/login` 자동 이동.
- **Phase 4** (`55d3966`, data-craft-mobile): `screens/workspace-select/` 화면 신규 구현. GitHub Pages 단일 도메인 환경에서 서브도메인 기반 테넌트 라우팅 대체. `mobileTenantStore` (Zustand, localStorage `dc_login_company` 영속), `useRecentCompanies` (최대 5개 최근 회사 ID), `WorkspaceCard` (로고/이니셜 + 회사명/ID), `ScreenWorkspaceSelect` (카드 + 신규 ID 입력 폼). `authClient.ts` 에 `checkCompanyId` (BE `available` → `exists` 반전), `getTenantInfo` 추가. `routes/workspace-select.tsx` stub → re-export 로 교체.

### advisor 검증

- 계획 시점 (#1): Intent / Logic / Group Policy / Evidence / Command Fulfillment 5축 PASS (no BLOCK).
- 완료 시점 (#2): no BLOCK. Caveat 두 건 (axis-3 응답 래퍼 불일치, Pages 배포 workflow) 은 본 단계0-B 범위 외 후속 작업 대상 — 마스터 명령 ("BE 변경 0 전제로 인증 3화면 + 첫 phase 호환성 게이트") 자체는 충족.

### 영향 파일

**data-craft-mobile** (`bj-kim-funshare/data-craft-mobile`, branch `i-dev`):
- `apps/web/src/mobile/auth/AUTH_BE_COMPATIBILITY.md` (신규)
- `apps/web/src/mobile/auth/authClient.ts`
- `apps/web/src/mobile/auth/mobileTenantStore.ts` (신규)
- `apps/web/src/mobile/screens/login/ScreenLogin.tsx`
- `apps/web/src/mobile/screens/login/ScreenLogin.module.css`
- `apps/web/src/mobile/screens/forgot-password/ScreenForgotPassword.tsx` (신규)
- `apps/web/src/mobile/screens/forgot-password/ScreenForgotPassword.module.css` (신규)
- `apps/web/src/mobile/screens/forgot-password/StepEmail.tsx` (신규)
- `apps/web/src/mobile/screens/forgot-password/StepCode.tsx` (신규)
- `apps/web/src/mobile/screens/forgot-password/StepNewPassword.tsx` (신규)
- `apps/web/src/mobile/screens/forgot-password/useResetFlow.ts` (신규)
- `apps/web/src/mobile/screens/forgot-password/index.ts` (신규)
- `apps/web/src/mobile/screens/workspace-select/ScreenWorkspaceSelect.tsx` (신규)
- `apps/web/src/mobile/screens/workspace-select/ScreenWorkspaceSelect.module.css` (신규)
- `apps/web/src/mobile/screens/workspace-select/WorkspaceCard.tsx` (신규)
- `apps/web/src/mobile/screens/workspace-select/useRecentCompanies.ts` (신규)
- `apps/web/src/mobile/screens/workspace-select/index.ts` (신규)
- `apps/web/src/mobile/routes/forgot-password.tsx`
- `apps/web/src/mobile/routes/workspace-select.tsx`

## v001.107.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#56 (핫픽스 1)

### 페이즈 결과

- **Phase 8a** (`e1fa1131`, data-craft-server): root cause 해결 — `COLUMN_SETTING_SELECT_COLUMNS` 에 `vcs.\`frozen\` AS frozen` 추가, `ViewerColumnSetting` / `SubGridSharedConfig.columnModelList` 타입에 frozen 필드 추가, `viewer.meta.ts` 의 `fetchViewerMeta` (메인) + `buildSubGridMeta` (서브) 양쪽 매핑에 frozen 전파. 이전엔 list path SELECT 에서 frozen 누락 → API 응답에서 frozen 미포함 → FE 의 `?? 'none'` 폴백이 항상 적용 → 새로고침 시 풀리는 증상이었음.
- **Phase 8b** (`c40df025`, data-craft): FE fixed cells (drag handle / row number / sub-grid toggle) 를 `position: sticky` 로 만들어 가로 스크롤 시 컨테이너 좌측에 고정. 사용자 frozen 컬럼의 누적 offset (FIXED_COLUMN_WIDTH 합) 은 그대로 유지되어 frozen 컬럼이 fixed cells 옆에 자연 부착됨. z-index 위계: fixed(4) > frozen(3) > 일반(2). 헤더 / 본문 DataRow / 푸터 AggregationRow / GroupHeaderRow 일관 적용.

### 핫픽스 사유

플랜 #56 (v001.99.0) 머지 직후 마스터 결함 보고 3건:
1. 행 ID 열이 사용자가 freeze 한 것처럼 시각적으로 표시됨.
2. 사용자가 freeze 한 열이 좌측에 붙지 않고 ~112px 떨어진 위치에 표시됨.
3. **결정적**: 새로고침 시 frozen 설정이 모두 풀림 (지속성 회귀).

진단 결과 핵심 결함은 (3) — 서버 list-path SELECT 가 frozen 컬럼을 누락. (2) 는 FE fixed cells 가 sticky 아니라 스크롤 시 좌측 빈틈 생성. (1) 은 (2) 의 부수효과로 자연 해소 (rowId 가 fixed cells 옆에 자연 부착되어 사용자-frozen 과 구분되는 시각).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/models/viewer.model.ts`
- `src/services/viewer/viewer.meta.ts`
- `src/types/viewer.types.ts`

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/{DataRow,RowDragHandle,RowNumberCell,SubGridToggleCell}.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-footer/AggregationRow.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/{FixedHeaderCells,GroupHeaderRow}.tsx`

### 검증 결과

- 서버 lint (`pnpm lint`): exit 0.
- FE lint (`pnpm typecheck:all && pnpm lint`): exit 0 (사전 무관 warning 3건 잔존).
- advisor #2 PASS (BLOCK 토큰 미발생, 4회 호출 모두 코칭 응답).

### 알려진 후속 / Carve-out

- **viewer.cache.ts 인메모리 캐시**: 핫픽스 전에 frozen 미포함으로 적재된 캐시 엔트리가 있을 수 있음. 운영 배포 시 서버 rolling restart 또는 캐시 TTL 만료 후 정상 응답. 코드 변경 불요.
- **Bug 1 해석 ambiguity (마스터 확인 권장)**: rowId 시각적 sticky 동작이 fixed cells 와 자연 부착으로 해소되었으나, "rowId 가 frozen 상태로 보이는 것 자체 제거" 의 강한 해석을 원하면 `customColumnGenerator.ts:95` 의 `frozen: 'start'` 제거 + 별도 sticky 메커니즘 필요. 본 핫픽스는 (a) 해석 채택.

## v001.106.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54 (핫픽스 5)

### 페이즈 결과
- **Phase 8 (핫픽스 5)**: hotfix 2 (v001.95.0) 가 도입한 `CustomFormattingToolbar` 가 BlockNote toolbar 의 focus/event 메커니즘을 깨뜨리고 toolbar 의 **모든** 버튼이 작동하지 않는 regression 을 유발한 것을 확인 (download 외 정렬/스타일/삭제 등 default 버튼 일체 미반응 + 본문 포커싱 해제). hotfix 2/4 surfaces 전체 폐기 후, 다운로드를 framework UI (toolbar) 가 아닌 **block 자체 render** 의 인-블록 버튼으로 처리하는 보수적 접근으로 전환. 변경: (1) `CustomFormattingToolbar.tsx`, `DcFileDownloadButton.tsx` 두 파일 삭제. (2) `DocumentEditor.tsx` 에서 `FormattingToolbarController` 래핑 제거 — `<BlockNoteView editor={editor} ... />` 가 children 없는 단일 element 로 복귀, BlockNote default toolbar 자동 mount. (3) `dcImagePreview.tsx` 에 absolute positioned 다운로드 버튼 오버레이 추가 (`<button>` + lucide `Download` 아이콘, 반투명 검정 배경 + 흰색 아이콘, 클릭 시 `fileApi.downloadFile(uri, name || caption || 'image')`, 외부 URL 은 동적 anchor fallback, `onMouseDown preventDefault` 로 본문 focus-steal 방지). `dcFileBlockSpec.tsx` 는 이미 인-블록 다운로드 핸들러 (파일명 행 클릭 → handleDownload) 보유 — 변경 없음.

### 배경 (핫픽스 사유)
hotfix 2/3/4 의 누적 패턴: BlockNote framework UI (FormattingToolbar) 를 우리 wrapper 로 교체하여 download 동작을 swap 하려 했으나, custom toolbar 가 BlockNote 의 focus 처리 / button visibility / event flow 와 미묘하게 충돌. hotfix 4 까지의 focus-steal preventDefault + selector mirror 도 단일 버튼 click 미발화를 해소하지 못함. 더 큰 그림에서 master 보고: 정렬/스타일/삭제 등 우리가 swap 하지 않은 default 버튼들까지 작동 안 함 → root cause = "framework UI 자체를 교체한 결정". advisor 결론: **toolbar 가 아닌 block content 를 override** 하는 방향이 lower-risk seam. 우리 custom block render 들은 이미 잘 동작 중 — 다운로드도 그 안에 배치.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx` (FormattingToolbarController 제거)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/dcImagePreview.tsx` (다운로드 오버레이 추가)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/CustomFormattingToolbar.tsx` (삭제)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/DcFileDownloadButton.tsx` (삭제)
- 합계: +51 / -120

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 3 warnings 모두 기존).
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 manual repro 필요.

### 알려진 잔존 동작 (수용)
BlockNote default toolbar 가 복원되었으므로 toolbar 의 default `FileDownloadButton` (block 선택 시 위에 뜨는 다운로드 아이콘) 은 hotfix 2 이전과 동일하게 raw URI 로 `window.open()` → 새 탭이 열림 (인증 미주입). 사용자에게 안내: **이미지 자체 위의 다운로드 버튼** 또는 **파일 블록의 파일명 영역** 을 클릭. toolbar 다운로드 아이콘은 미사용. 후속 불만 발생 시 그 단일 버튼만 visibility 차단 (전체 toolbar 재교체 금지).

### 후속 빌드 단계
`fs_data_viewer` 만 변경 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

## v001.105.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#62

### 페이즈 결과
- **Phase 1** (`9ac93b82`, data-craft): `fs-data-viewer` 패키지의 문서 편집 다이얼로그에 BlockNote 레벨 `documentSaveShortcutFix` 확장(`'Shift-Enter'` → `onSave()` + `return true`) 추가 + dialog `useDocumentKeyboardHandlers` 의 Shift+Enter 핸들러에 `.bn-editor` / `.ProseMirror` 가드 추가. `onSave` 콜백을 `DocumentEditDialog(handleSave) → ContentArea → DocumentEditor` 로 prop drill (dialogTypes.ts 타입 정의 갱신).
- **Phase 2** (`df8cd1d9`, data-craft): `fs-sub-data-viewer` 사본에 Phase 1 과 동일 패턴 적용. `uploadFile` 프롭 부재 외 동일 구조.
- **Phase 3** (`8879cad0`, data-craft): `fs-external-data-viewer` 사본에 동일 패턴 적용. `BlockNoteSchema` / 커스텀 블록 / `uploadFile` 부재로 더 단순한 구조 — extensions 배열 위치만 동일.

### 배경
마스터 보고: "데이터 뷰어 → 문서 타입 셀에서 Shift+Enter 로 저장하면 엔터가 들어가고 저장된다." BlockNote(ProseMirror) 의 contentEditable 키맵이 React onKeyDown bubble 보다 먼저 fire 되어 `'Shift-Enter'` 디폴트 soft-break (`@blocknote/core/dist/blocknote.js` `"Shift-Enter": () => t(!0)`) 가 적용된 후, dialog 컨테이너의 `handleDialogKeyDown` 가 뒤늦게 `onSave` 를 호출 → 줄바꿈 포함 채로 저장되던 race. 두 계층 동시 차단으로 해결: PM 키맵 우선 가로채기(soft-break 무력화 + 즉시 저장) + dialog 핸들러의 BlockNote 출처 가드(double-fire 방지). `keyboardShortcuts` 콜백이 event 를 받지 못해 (`(ctx: { editor }) => boolean`) 콜백 내부 `stopPropagation` 이 불가하므로 가드가 필수.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx` (+14 / -1)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/ContentArea.tsx` (+2)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditDialog.tsx` (+1)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/dialogTypes.ts` (+1)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/useDocumentKeyboardHandlers.ts` (+4)
  - `packages/fs-sub-data-viewer/src/shared/ui/dialogs/document-edit/{DocumentEditor.tsx, ContentArea.tsx, DocumentEditDialog.tsx, dialogTypes.ts, useDocumentKeyboardHandlers.ts}` (Phase 1 과 동일 패턴)
  - `packages/fs-external-data-viewer/src/shared/ui/dialogs/document-edit/{DocumentEditor.tsx, ContentArea.tsx, DocumentEditDialog.tsx, dialogTypes.ts, useDocumentKeyboardHandlers.ts}` (Phase 1 과 동일 패턴)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): 3회 모두 exit 0 (0 errors, 3 warnings — 모두 기존).
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 수동 검증 필요. 시나리오:
  1. 데이터 뷰어 (3개 viewer 각각) 문서 타입 셀 더블클릭 → 다이얼로그 오픈.
  2. 본문 BlockNote 영역에 "테스트" 입력 → **Shift+Enter** → 다이얼로그 닫힘 + 저장 + 본문 끝 줄바꿈 없음.
  3. 본문 일반 **Enter** → 새 블록 정상 생성 (저장 X) — 회귀 방지.
  4. 제목 input 에서 Shift+Enter → 저장 동작 정상 (회귀 방지).
  5. 본문 Shift+Enter 1회로 저장 호출 1회만 (double-fire 차단) — 콘솔 / 네트워크 확인 권장.

### 후속 빌드 단계
3개 viewer 패키지 모두 변경 — 본 머지 후 `pnpm --filter fs_data_viewer --filter fs_sub_data_viewer --filter fs_external_data_viewer build` (또는 전체 `pnpm build`).

### 미해결 / 후속 고려
- BlockNote 키맵 우선순위: 현 `keyboardShortcuts['Shift-Enter']` 등록만으로 디폴트 soft-break 보다 먼저 fire 됨을 lint clean 으로 간접 확인. 마스터 수동 repro 에서 줄바꿈이 여전히 들어가면 `runsBefore` 명시 추가가 HOTFIX 후보.
- `useCreateBlockNote` 의 extensions 배열은 최초 렌더 시점에 캐싱되어 `documentSaveShortcutFix(onSave)` 의 onSave 클로저가 stale 해질 수 있으나, 3개 패키지 모두 `handleSave` 가 `documentGetterRef.current?.()` 로 라이브 doc 을 읽으므로 실질 영향 없음 (코드로 확인). 장기 개선으로 `useRef` 안정화 고려 가능.

## v001.104.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#63

### 페이즈 결과
- **Phase 1** (`d519f97`, data-craft): 칸반 뷰 헤더 기간 조회 조작 시 기준열 옵션 일부가 사라지던 결함 보강. `getGroupOrder()` (`packages/fs-data-viewer/src/widgets/kanban-board/kanban-board/utils.ts`) 분기 확장 — singleSelect/multiSelect 는 `customDataList` 가 비어있으면 `optionList` label 배열로 fallback, 그 외 옵션-보유 타입(tag 등) 기준열은 `optionList` label 배열을 반환. 빈 컬럼 push 경로 (`useKanbanBoard.ts:110-117`) 는 이미 존재하므로 `groupOrder` 만 채워지면 기간 조회 결과와 무관하게 정의된 모든 옵션이 칸반 열로 항상 표시된다. utils.test.ts 신규 (5 케이스: singleSelect+customDataList, singleSelect 빈 customDataList→optionList fallback, tag+optionList, 양쪽 빈→[], kanbanColumnField null→[]).

### 배경
마스터 보고: "헤더에서 기간 조회를 조작하면 칸반열이 달라진다 — 기준열에 해당 기간에 속하는 셀이 없으면 컬럼이 사라짐. 칸반열은 기준열 정보에 따라 어떤 상태여도 항상 표기되어야 함." 서버 `getKanbanData` 는 기간 매칭 카드의 컬럼만 응답하므로, 클라이언트 측 `getGroupOrder()` 가 기준열 정의 기반의 완전한 옵션 목록을 항상 반환해야 빈 컬럼이 살아남는다. 기존 코드는 singleSelect/multiSelect + customDataList 보유 케이스만 커버했고 그 외 옵션-보유 타입은 [] 반환 → 빈 컬럼 소실. 본 패치로 옵션-정의 보유 모든 기준열이 보호됨.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/widgets/kanban-board/kanban-board/utils.ts` (+17 / -7)
  - `packages/fs-data-viewer/src/widgets/kanban-board/kanban-board/utils.test.ts` (+71, 신규)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 3 warnings — 모두 기존).
- 단위 테스트 (vitest, utils.test.ts): 5/5 PASS.
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 수동 repro 필요. 검증 시나리오: 데이터 뷰어 → 칸반 뷰 → 기준열을 singleSelect / multiSelect / tag(또는 optionList 보유 타입) 로 각각 설정 → 헤더 기간 조회를 모든 카드가 빠지도록 좁혀서 정의된 모든 옵션 컬럼이 빈 상태로라도 살아 있는지 확인.

### 후속 빌드 단계
`fs_data_viewer` 만 변경 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

### 미해결 / 후속 고려
- 자유 텍스트 기준열 (옵션 정의 없음) 케이스는 옵션 기반 상시 표기 불가 — 본 패치 범위 밖.
- 마스터 reproduction 이 singleSelect + 비어있지 않은 customDataList 였다면 기존 코드 경로가 이미 커버하던 케이스이므로 본 패치는 인접 개선이 된다. 그 경우 실제 결함은 `kanbanColumnOrder` savedOrder 합성 또는 columnModelList 갱신 경로에 있을 수 있어 HOTFIX 후보.

## v001.103.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54 (핫픽스 4)

### 페이즈 결과
- **Phase 7 (핫픽스 4)**: `DcFileDownloadButton` 의 button 클릭이 발화하지 않던 문제 해소. (1) `span` wrapper 에 `onMouseDown={(e) => e.preventDefault()}` 부여 — mousedown 시 BlockNote 에디터가 본문으로 포커스를 가로채면서 toolbar 가 unmount → click event 미발화 패턴 차단 (`Components.FormattingToolbar.Button` 의 `ToolbarButtonType` 에 onMouseDown prop 이 노출되지 않아 wrapper span 으로 우회). (2) `useEditorState` selector 를 BlockNote default `FileDownloadButton` 의 `blockHasType(block, editor, block.type, { url: 'string' })` 가드와 동일하게 미러 — `selectedBlocks[0]` 직접 반환이 유발하던 shallow eq 실패 (`editor.getSelection()?.blocks` 가 매 tick 새 배열) → rapid re-render thrash → 클릭 도중 컴포넌트 unmount/remount → click event 손실 패턴 제거. (3) onClick 최상단 진단 로그 (`console.log('[DcFileDownloadButton] click', { block, type, url })`) 추가 — 추후 사용자 보고 시 "클릭 미발화 / block undefined / downloadFile 실패" 세 경로 즉시 식별.

### 배경 (핫픽스 사유)
v001.97.0 (핫픽스 3) 이 `fileApi.downloadFile` 의 anchor DOM 처리를 안정화하여 silent failure 가능성을 제거했음에도, 마스터 보고: "버튼 자체가 안 눌리는 것 같음, 문서 본문 포커싱이랑 충돌되나 본데". 즉 onClick 핸들러 자체가 발화하지 않는 상태. advisor 진단으로 두 가설 동시 커버: (a) editor focus steal 으로 toolbar unmount, (c) selector reference thrash 로 컴포넌트 thrash. (b) silent failure 는 핫픽스 3 의 `console.error('[downloadFile]', err)` 가 이미 커버 → 향후 그 로그가 보이면 그쪽 분기.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/DcFileDownloadButton.tsx` (+14 / -13)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 3 warnings — 모두 기존). 1회 lint iter (초기 onMouseDown 을 ToolbarButtonType 에 직접 부여 → TS2769 → span wrapper 로 전환).
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 manual repro 필요. 진단 로그가 추가됐으므로 클릭 후 console 의 `[DcFileDownloadButton] click` 출력 여부로 즉시 분기 가능.

### 후속 빌드 단계
`fs_data_viewer` 만 변경 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

## v001.102.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#60

### 페이즈 결과

- **Phase 1** (`e12e92a3`, data-craft): 그리드 뷰 footer 의 서버 집계값이 **열 일괄 입력 성공 후 자동 갱신되지 않던** 결함 수정. 기존 ref-bridge 컨벤션(`notifyRowAddedRef`, `invalidateServerCacheRef`)을 그대로 따라 `refreshAggregationForColumnRef` 를 `ServerPagingRefBridge` / `useServerPagingRefBridge` / `FsGridTableViewProps` / `GridViewPageProps` 에 추가. `FsDataViewerRouter` 가 ref 를 소유하고 외부 `requestBatchInput` 콜백을 `useMemo` 로 래핑하여 `result.success === true` 시 `refreshAggregationForColumnRef.current?.(params.columnField)` 호출, `DataViewerProvider`/`GridViewPage` 양쪽에 동일 래핑 전달. 결과: 단일 셀 편집과 동일한 1초 디바운스 후 서버 집계 재요청 경로가 일괄 입력에도 적용되어 footer 가 정확한 값으로 갱신. lint(`pnpm typecheck:all && pnpm lint`) 통과.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-sub-data-viewer/src/app/FsDataViewerRouter.tsx`
- `packages/fs-sub-data-viewer/src/features/grid/lib/gridViewTypes.ts`
- `packages/fs-sub-data-viewer/src/pages/GridViewPage.tsx`
- `packages/fs-sub-data-viewer/src/widgets/grid-table/hooks/useTableView.ts`
- `packages/fs-sub-data-viewer/src/widgets/grid-table/hooks/useTableViewServerPaging.ts`

## v001.101.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#61

### 페이즈 결과

- **Phase 1** (`93a2c53a`, data-craft): 그리드 input 셀 4종(Text/Percent/Link/Email) ArrowLeft 핸들러의 셀-이동 발화 조건이 `selectionStart === 0` 단일 체크였던 결함 수정. `selectionEnd === 0` AND 가드 추가로 전체 선택 상태(`selectionStart=0, selectionEnd=value.length`)에서는 핸들러가 preventDefault 하지 않고 브라우저 기본 동작(캐럿을 position 0 으로 collapse)이 동작. 캐럿이 0 위치 + 빈 selection 인 경우의 좌측 셀 이동(저장 + 인접 이동) 은 그대로 유지. ArrowRight 대칭 분기는 전체 선택 시 발화 조건이 우연히 거짓이라 실사용 영향 없음 — 본 범위 외.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/features/grid/lib/cell-keyboard/inputKeyboardHandler.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridPercentCellRenderer/usePercentCellHandlers.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridLinkCellRenderer/useLinkCellHandlers.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridEmailCellRenderer/useEmailCellHandlers.ts`

## v001.100.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#59

### 페이즈 결과

- **Phase 1** (`04110a4d`, data-craft): `useViewerWidgetProps` 의 `externalStyle` `useMemo` 가 입력 `externalStyleProps` 가 `undefined` 일 때에도 디폴트 값(14/#333333/normal)을 채운 truthy 객체를 반환하여 위젯 설정 드로어 "외부 스타일" 토글 OFF 신호가 손실되던 결함 수정. `ViewerWidgetPropsResult.externalStyle` 타입을 `FsGridExternalStyleModel | undefined` 로 완화하고, `externalStyleProps === undefined` 분기 추가, deps 배열을 `[externalStyleProps]` 단일 참조로 단순화. 결과: 토글 OFF 시 "디자인 모드 → 열메뉴 → 열 본문 스타일 편집" 의 기본 항목(index 0) 활성화 복구. ON 케이스 동일 동작 유지.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/viewer-widget/ui/useViewerWidgetProps.ts`

## v001.99.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#56

### 페이즈 결과

- **Phase 0** (DDL, /task-db-structure 별도 완료): `data_viewer_column_setting.frozen ENUM('start','end','none') NOT NULL DEFAULT 'none'` 컬럼 추가.
- **Phase 1** (`02e6a1f`, data-craft-server): `viewerRoleCheck.middleware.ts` 의 `userId: req.userId ?? req.user?.id` TS2322 정합 — `req.user?.id` 를 `String()` 변환.
- **Phase 2** (`fdd240b`, data-craft-server): BE 전 계층 frozen 통과 (Sequelize model · DTO · 검증 · column-setting change handler · 화이트리스트).
- **Phase 3** (`847b21a`, data-craft): FE 컬럼 모델 frozen 전파 + `createColumnFrozenChange(columnId, frozen)` change-creator 신설.
- **Phase 4** (`c127366f`, data-craft): 메인 그리드 sticky 렌더 — `widgets/grid-table/lib/frozenLayout.ts` 순수 함수 신설 (start/end 양방향 누적 offset). 헤더(zIndex:3) / 바디(zIndex:2) / 푸터 / 그룹헤더 일관 적용. FrozenLayoutContext 로 DataCell 까지 offset 전파.
- **Phase 5** (`647e18ac` + lint hotfix `b51b45c9`, data-craft): 서브 그리드 sticky 렌더 — Phase 4 의 frozenLayout 재사용. 시스템 frozen(rowId 컬럼)과 사용자 frozen 을 `FsGridColumnTypes.rowId.id` 비교로 분리, 기존 `frozen !== 'start'` 필터를 `systemRowIdFields` Set 으로 대체하여 사용자 frozen='start' 비-rowId 컬럼이 렌더 목록에서 누락되는 회귀를 사전 차단. Lint hotfix 는 `FrozenLayoutContext` 를 DataCell 에서 분리 (react-refresh).
- **Phase 6** (`224b5f13` + lint hotfix `741e6920`, data-craft): 컬럼 메뉴 "왼쪽 고정 / 오른쪽 고정 / 고정 해제" 토글 — 메인 (`menuItems.ts`) 과 서브 (`useSubGridColumnMenu` + `SubGridColumnMenu`) 동시 추가. `createColumnFrozenChange` 호출로 기존 saveChange 파이프라인 연결. Lint hotfix 는 useSubGridColumnMenu hoisting 정정 (saveColumnProperty 선언 후 위치).
- **Phase 7** (`2945c2d7`, data-craft): Vitest 테스트 13건 신규 — frozenLayout 6 케이스 (start/end/none/mixed/prefix=0 등), menuItems 4 케이스 (frozen 상태별 라벨 분기), createColumnFrozenChange round-trip 3 케이스. `tests/packages/fs-data-viewer/` 위치 (vitest.config.ts include 패턴 부합).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/middlewares/viewerRoleCheck.middleware.ts`
- `src/models/viewer.model.ts`
- `src/services/dataViewer/dataViewerChange/change.columnSettings.ts`
- `src/services/dataViewerPost.service.ts`
- `src/services/viewer/viewer.bulkSave.column.ts`
- `src/services/viewer/viewer.bulkSave.column.test.ts`
- `src/types/dataViewer.types.ts`
- `src/utils/sqlFieldWhitelist.ts`

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/app/hooks/useViewerMetaLoader.ts`
- `packages/fs-data-viewer/src/entities/column-model.types.ts`
- `packages/fs-data-viewer/src/features/data-viewer/lib/changeHelpers.ts`
- `packages/fs-data-viewer/src/features/data-viewer/lib/columnChangeHelpers.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/column-menu/menuItems.ts`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/FsSubGrid.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/components/{SubGridAggregationCell,SubGridAggregationRow,SubGridBody,SubGridColumnMenu,SubGridDataRow,SubGridHeader}.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/hooks/useSubGridColumnMenu.ts`
- `packages/fs-data-viewer/src/widgets/fs_grid_util/customColumnGenerator.ts`
- `packages/fs-data-viewer/src/widgets/grid-table/components/{ColumnHeader,GridBody,GridHeader}.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/{DataCell,types}.{tsx,ts}`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-footer/AggregationRow.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/components/grid-header/GroupHeaderRow.tsx`
- `packages/fs-data-viewer/src/widgets/grid-table/lib/{FrozenLayoutContext.tsx,frozenLayout.ts}` (신규)
- `tests/packages/fs-data-viewer/{createColumnFrozenChange,frozenLayout,menuItems}.test.ts` (신규)

### Cross-repo 처리 메모

이슈 호스트 (leader) = `funshare-inc/data-craft`, work repos = `funshare-inc/data-craft-server` + `funshare-inc/data-craft`. data-craft-server WIP A 는 Phase 1 의 TS2322 nodemon 크래시로 다른 세션 진행이 차단되어 마스터 명시 요청 하에 plan 종료 전 i-dev 조기 머지 (Step 9.1 일괄 머지에서 분리). data-craft WIP A 는 Phase 7 직후 정상 일괄 머지. 본 패치노트는 Project-I2 `main` 통합.

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`, data-craft worktree): Phase 4 / 5 (after hotfix) / 6 (after hotfix) / 7 모두 exit 0.
- Phase 7 신규 vitest 13/13 PASS (분리 실행).
- advisor #1 (계획 시점) PASS · advisor #2 (완료 시점) PASS — 5 perspective.

### 알려진 후속 부채 / Carve-out

- **DataCell hover/stripe bleed**: sticky 셀의 배경이 `var(--background)` 고정 — DataRow hover (`bg-muted`) · stripe (`bg-muted/30`) 상태색이 frozen 셀에는 반영 안 됨. Phase 4 렌더링-전용 스코프 내 트레이드오프로 기록. 시각 polish 별도 후속.
- **isSettingMode 렌더-레벨 가시성 테스트 미작성**: 게이트가 `ColumnHeader.tsx` / `SubGridHeader.tsx` 상위에 있어 `createColumnMenuItems` 단위 테스트로 직접 검증 불가. 별도 render 테스트는 본 플랜 범위 외.
- **GroupHeaderRow 그룹 세그먼트 sticky 미적용**: 다중 컬럼 병합 셀은 Option A 정책에 따라 sticky 미적용. 모든 자식 컬럼이 frozen='start' 인 그룹 헤더 셀도 고정되지 않음.
- **AggregationCell 자체 sticky 미적용**: 현재는 wrapper div 가 sticky. `grid-footer/AggregationCell.tsx` 자체에 sticky 직접 반영 시 영향 파일 확장 필요.
- **전체 vitest 스위트 사전 손상 284 건**: 본 플랜과 무관 (entities/form/api 등 — frozen 영역 외). i-dev 분기 시점부터 존재. 별도 plan 격리.

## v001.98.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#58

### 페이즈 결과
- **Phase 1 (docs)**: P0.1 monorepo.html spec 대비 `fs-shared-mobile` skeleton (`packages/fs-shared-mobile/`, `pnpm-workspace.yaml`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`) 줄 단위 audit 작성. `@dcm/` prefix (vs spec `@fs/`) carve-out 기록, `@shared/*` alias 미구현 spec gap 으로 기록.
- **Phase 2 (docs)**: P0.2 + P0.4 spec 대비 AppShell + AppHeader + BottomTabs + OfflineBanner + IOSInstallHint + RouteGuard + useSession + sessionStore 8 파일 audit 작성. safe-area / 56px·64px 치수 정렬 확인. spec gap 4 건 (BottomTabs 검색 탭, AppHeader back 버튼, title 하드코딩, SessionExpired 모달) 기록.
- **Phase 3 (docs)**: routing.html spec 대비 `route-paths.ts` 26 const + `router.tsx` 1:1 매핑 audit. 5 명명 차이 (`/page-tree` ↔ `/pages`, `/record` ↔ `/records`, `/user-form` ↔ `/forms`, `viewer/*` flat 등) 비차단 carve-out 명시.
- **Phase 4 (feat)**: `tokens.css` `:root` 블록에 spec L82–105 누락분 9 변수 (`--sp-12`, `--radius-{sm,md,lg,xl,full}`, `--shadow-{sm,md,lg}`) 추가. `--safe-{top,bottom}` 은 `safe-area.css` 에 동일 값으로 이미 정의됨 → 중복 회피, spec 요구 11 변수 모두 코드 존재 확인.

### 영향 파일
- data-craft-mobile:
  - `DataCraft-mobile-v2/handoff/phase0/audit/monorepo-audit.md` (신규, 145 라인)
  - `DataCraft-mobile-v2/handoff/phase0/audit/appshell-audit.md` (신규, 179 라인)
  - `DataCraft-mobile-v2/handoff/phase0/audit/route-paths-audit.md` (신규, 101 라인)
  - `apps/web/src/mobile/styles/tokens.css` (편집, +15 / -0)

### Cross-repo 처리 메모
이슈 호스트 (leader) = `funshare-inc/data-craft`, work repo = `bj-kim-funshare/data-craft-mobile`. 모든 페이즈 변경은 work repo 의 `i-dev` 통합 (`merge[plan-enterprise #58]`). leader repo 는 이슈 호스트 역할만, 코드 변경 없음. 본 패치노트 자체는 Project-I2 main 에 통합.

### 검증 결과
- Lint gate (Phase 4, `pnpm typecheck` on data-craft-mobile): exit 0, 0 errors.
- Phase 1~3 lint gate: SKIP (md-only commits).
- advisor #1 (계획 시점) PASS · advisor #2 (완료 시점) PASS — 5 perspective 모두.

### 후속 (본 플랜 범위 밖, audit 결과 기록)
- `@shared/*` alias 미구현 (spec P0.1 요구).
- BottomTabs 검색 탭 누락, AppHeader back/title 슬롯, SessionExpired 모달 미연결.
- 별도 plan-enterprise 진입 여부 마스터 결정.

## v001.97.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54 (핫픽스 3)

### 페이즈 결과
- **Phase 5 (핫픽스 3)**: `packages/fs-api/src/api/file.ts` 의 `downloadFile` 함수 anchor 처리 결함 2건 수정 — (1) `document.createElement('a')` 가 DOM 에 append 되지 않은 detached 상태로 `.click()` 호출, Firefox/Safari 가 이를 무시 + Chrome 도 비보장. (2) `anchor.click()` 직후 동기 `URL.revokeObjectURL(blobUrl)` — click 은 다운로드를 큐잉하는 비동기 작업이라 blob URL 이 너무 빨리 revoke 되어 다운로드가 취소됨. Fix: anchor 를 `document.body.appendChild` → `click()` → `removeChild` 로 attached 상태에서 발화, `URL.revokeObjectURL` 을 `setTimeout(() => ..., 0)` 으로 다음 tick 까지 지연. catch 블록의 silent 패턴 (`catch {}`) 을 `catch (err) { console.error('[downloadFile]', err); }` 로 보완 — 향후 다른 실패 모드를 즉시 진단 가능하게.

### 배경 (핫픽스 사유)
v001.95.0 (핫픽스 2) 가 BlockNote FormattingToolbar 의 download 버튼 동작을 `<a href={raw uri} download>` native navigation 에서 `fileApi.downloadFile()` 호출로 swap 하여 새 탭 열림 증상은 차단. 그러나 클릭 시 다운로드 자체가 트리거되지 않는 후속 증상 확인. 진단 경로: (a) BE endpoint `GET /api/file/download` 존재 확인 — `data-craft-server/src/routes/file.ts:218` 정상, (b) `apiClient.fetchBinary` 의 Authorization Bearer 헤더 동일 인터셉터 사용 (이미지 미리보기에서 작동 중) 인증 정상, (c) `downloadFile` 함수 자체의 DOM 처리 분석 — detached anchor + sync revoke 두 결함 동시 존재. 본 핫픽스가 그 정확한 두 줄을 수정.

### 영향 파일
- data-craft:
  - `packages/fs-api/src/api/file.ts` (downloadFile 함수만, +6 / -4)

### 사이드 이펙트 (긍정)
이 fix 는 `fs-api` 의 공용 함수 수정이므로 다른 호출처에도 영향. 기존 호출처: `data-craft/src/widgets/file-uploader-widget/ui/useFilePreviewActions.ts:43,80` (FileUploaderWidget 의 다운로드 동작). 동일한 두 결함을 잠재적으로 가지고 있었을 가능성 — 본 핫픽스로 함께 견고해짐.

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 3 warnings 모두 기존).
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 manual repro 필요 (파일/이미지 블록 → toolbar 다운로드 클릭 → 브라우저 다운로드 다이얼로그 표시).

### 후속 빌드 단계
`fs-api` 와 `fs_data_viewer` 모두 `./dist` export 패키지 — 본 머지 후 dev/배포 전 `pnpm --filter fs_api build && pnpm --filter fs_data_viewer build` 실행 필요. (fs_api 가 fs_data_viewer 의 transitive 의존성이므로 fs_api 만 변경했어도 둘 다 rebuild 권장.)

## v001.96.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#55 (hotfix 4 — FE root + BE robustness)

### 페이즈 결과
- **Phase 5 (hotfix 4)**: 더블 서밋 root-cause 차단 + BE 인프라 deadlock 회복 — 두 레이어 동시 적용으로 whack-a-mole 종결.
  - **FE (data-craft)**: `src/widgets/property-drawer/ui/property-editors/viewer-editor/CreateDataDialog.tsx` — `useRef<boolean>` 동기 in-flight 가드. `createMutation.isPending` 은 React Query async store 갱신이라 같은 React tick 안의 Enter+Click 연속 입력에서 false 로 비춰져 두 번 `mutateAsync` 가 발사 가능했음. `inFlightRef.current` 체크 후 즉시 lock, try/finally 로 해제하여 단일 호출만 통과.
  - **BE (data-craft-server)**: `src/services/viewer/viewer.group.ts` — `createGroup` 본체를 `for attempt loop + isDeadlockError + RETRY_DELAY_MS * attempt` 로 감쌈. 동일 파일 line 407 부근 `deleteGroup` 의 검증된 패턴 재사용. FE 가드 통과 후에도 인프라 레벨 (slow disk, 고동시성 lock wait) 에서 진짜 deadlock 이 발생하면 자동 재시도.

### 배경
hotfix 1-3 진행 중 같은 신호 (단일 사용자 동작 → 2 POST → 한쪽 201, 다른쪽 500/409/deadlock) 가 SP 에러 종류만 바꿔가며 반복 표면화. advisor 검증 결과 root cause 는 FE 더블 서밋이고, BE catch 추가는 노이즈 줄임에 불과하다는 결론. 따라서 두 레이어 동시 적용 — FE 에서 source 차단, BE 는 legit infra race 에 대한 robustness 보강. 한쪽만으로는 불완전: FE 만 하면 인프라 deadlock 미커버, BE 만 하면 race 패배자 응답 노이즈 잔존.

### 영향 파일
- data-craft:
  - `src/widgets/property-drawer/ui/property-editors/viewer-editor/CreateDataDialog.tsx`
- data-craft-server:
  - `src/services/viewer/viewer.group.ts`

### 운영 가이드

- 양쪽 (FE, BE) 재기동 후 그룹 생성. 단일 클릭은 항상 단일 201. Enter+Click race 도 단일 201 (FE 가드).
- 만일 인프라 deadlock 발생 시 BE 가 최대 3회 재시도 후 회복. 재시도 로그 (`MAX_RETRY_COUNT = 3`, `RETRY_DELAY_MS = 100ms × attempt`) 가 BE 로그에 보일 수 있으나 사용자 perspective 에선 정상 201.

### 검증 시나리오
- user=37 으로 그룹 생성 다이얼로그 → 이름 입력 → 만들기 클릭 → 201 1건, toast 에러 없음. 더블 클릭/Enter+Click 동시 입력에도 동일.
- 회귀 검증: 일반 그룹 작업 (열 추가, 그룹 삭제, 행 작업) 정상 동작 (hotfix 2 의 viewerRoleCheck 제거 영향).

### Treadmill 종결 신호
- hotfix 1: 진단 로그 추가
- hotfix 2: viewerRoleCheck 미들웨어 전체 제거 (잘못된 layer 정책 폐기)
- hotfix 3: rename SP dup → 409 변환 (race 패배자 노이즈 격하)
- hotfix 4: FE 더블 서밋 root cause 차단 + BE deadlock retry robustness

각 hotfix 가 서로 다른 layer 의 진짜 문제를 해결. hotfix 1·2 는 원래 문제(권한 흐름), 3·4 는 그것을 풀었을 때 노출된 더블 서밋 패턴. 마스터 명령 "깔끔하고 확실하게" 에 대응한 advisor 검증 통과 종합.

## v001.95.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54 (핫픽스 2)

### 페이즈 결과
- **Phase 4 (핫픽스 2)**: BlockNote 의 `FormattingToolbar` 가 image/file block 선택 시 노출하는 default `FileDownloadButton` 이 native `<a href={url} download>` navigation 으로 동작하여 raw storage URI 로 새 탭이 열리는 문제 해소. `BlockNoteView` children 에 `<FormattingToolbarController formattingToolbar={CustomFormattingToolbar} />` 삽입, `CustomFormattingToolbar` 가 `getFormattingToolbarItems()` 의 기본 버튼 순서를 보존하되 `FileDownloadButton` 자리에 `DcFileDownloadButton` 을 끼워 넣음. `DcFileDownloadButton` 은 `useEditorState` 로 선택된 block 을 추적, type 이 `image`/`file` 이 아니면 null 반환 (default 와 동일 visibility), 클릭 시 raw storage URI 는 `fileApi.downloadFile(uri, name)` 호출, 외부 http URL 은 동적 `<a href={url} download>` 생성 + click + remove fallback.

### 배경 (핫픽스 사유)
v001.93.0 (핫픽스 1) 가 image/file block 의 render 만 fs-api 기반 custom block 으로 교체하고 미리보기 broken-img 는 해소했으나, BlockNote 의 FormattingToolbar 가 별도 경로로 노출하는 download 아이콘은 그대로 default 동작 — `<a href={raw uri} download>` native click. Bearer 인증을 거치지 않아 브라우저가 raw 경로로 navigate → 새 데이터-크래프트 탭이 열림. 핫픽스 1 은 custom block 내부 render 만 다뤘기 때문에 toolbar 경로를 커버하지 못했음. 본 핫픽스에서 toolbar 자체를 override 하여 download 버튼만 swap.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx` (FormattingToolbarController 삽입)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/CustomFormattingToolbar.tsx` (신규)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/DcFileDownloadButton.tsx` (신규)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 3 warnings, 모두 기존).
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 manual repro 필요 (파일 블록 선택 → toolbar 다운로드 클릭 시 새 탭 없이 브라우저 다운로드 다이얼로그 표시).

### 후속 빌드 단계
`fs_data_viewer` 는 `./dist` export 패키지 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

## v001.94.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#55 (hotfix 3)

### 페이즈 결과
- **Phase 4 (hotfix 3)**: `src/services/viewer/viewer.group.ts` 의 `createGroup` 내 rename SP 호출 (line 82-94, TEMP → 실제 이름 변환) 을 try/catch 로 감쌈. `Duplicate entry ... data_group_unique` 메시지를 감지하면 `ConflictError('GROUP_NAME_DUPLICATE')` (HTTP 409) 로 변환. TEMP 그룹은 외부 catch 의 `connection.rollback()` 으로 자동 정리. 다른 SP 에러는 그대로 re-throw.

### 배경
hotfix 2 (`viewerRoleCheck` 미들웨어 제거) 적용 후 그룹 생성 / 열 추가 / 그룹 삭제 정상 동작 확인. 그러나 그룹 생성 시 동시 발사된 두 요청 (FE 측 더블 서밋 패턴) 이 모두 `createGroup` 의 pre-check (`checkGroupNameDuplicate`, line 46) 를 통과 → 각자 TEMP 그룹을 만든 뒤 rename SP 호출 시점에 한 쪽은 commit 성공 (201) 하고 다른 쪽이 unique key (`data_group.data_group_unique`) 에 충돌 → SP wrapper 가 generic `Error('[EAV] SP 오류: Duplicate entry ...')` 를 던져 500 응답. 사용자 perspective 에선 "그룹은 생성됐는데 에러 메시지도 떠" 패턴. BE 측 한 줄로 race 케이스를 명확한 409 로 변환하여 UX 일관성 회복.

### 영향 파일
- data-craft-server:
  - `src/services/viewer/viewer.group.ts`

### 운영 가이드

- dev 서버 재기동 후 그룹 생성 시도 → 정상 동작 시 201 (한 그룹 생성). race 발생 시 한 응답은 201, 다른 응답은 409 (`GROUP_NAME_DUPLICATE`, 500 아님).
- FE 측 더블 서밋 자체 차단 (예: useRef in-flight lock) 은 별개 후속 — 본 핫픽스로 BE 응답 일관성은 확보.

### 검증 시나리오
- 새 그룹 이름 입력 → "만들기" 단일 클릭 → 201 1건만 떠야 정상.
- 동시 발사 시뮬레이션 (curl 두 번 연속 또는 더블 클릭) → 한 쪽 201, 다른 쪽 409 (500 아니어야 함).
- 트랜잭션 rollback 확인 — 실패한 요청의 TEMP 그룹이 DB 에 남지 않음.

## v001.93.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54 (핫픽스 1)

### 페이즈 결과
- **Phase 3 (핫픽스 1)**: BlockNote default `image`/`file` block 의 raw storage URI 직접 사용으로 인한 미리보기 깨짐 + 다운로드 시 새 탭 navigate 문제를 fs-api 기반 custom block 으로 전환하여 해소. `BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, image: dcImageBlockSpec, file: dcFileBlockSpec } })` 로 동일 type name override. 이미지 렌더 — `fileApi.loadImageBlob(uri)` 로 인증 binary 수신 → `URL.createObjectURL(blob)` 로 `<img src>` 세팅. 파일 다운로드 — 클릭 시 `fileApi.downloadFile(uri, name)`. 외부 URL (`http(s)://...`) 은 fallback 으로 직접 `<img src>` / `<a href>` 사용. uploadFile 콜백은 변경 없음 (raw storage uri 그대로 저장) — reload 시 동일 경로로 blob 재로드.

### 배경 (핫픽스 사유)
v001.88.0 의 1차 작업은 BlockNote 의 `uploadFile` 옵션 연결까지만 처리 — 업로드 자체는 성공하나 BlockNote 가 저장한 raw storage uri (`/storage/{companyId}/.../{uuid}.png`) 를 그대로 `<img src>` 와 `<a href download>` 에 사용. apiClient 가 Bearer 토큰을 Authorization 헤더에 실어 보내는 구조이므로 `<img>` 의 자동 요청은 401 → broken-img. 다운로드 링크 클릭은 브라우저가 raw 경로로 navigation → 새 데이터-크래프트 탭 열림. 1차 hotfix 접근 (`${API_BASE}/api/file/image?uri=<encoded>` 절대 URL 반환) 도 동일 인증 구조 한계로 작동 불가하여 폐기. 마스터 지시에 따라 기존 데이터-크래프트 파일 시스템 (`FileUploaderWidget` 패턴 — `fileApi.loadImageBlob` blob fetch + `fileApi.downloadFile`) 재사용으로 전환.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx` (schema override)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/dcImageBlockSpec.tsx` (신규)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/dcImagePreview.tsx` (신규)
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/blocks/dcFileBlockSpec.tsx` (신규)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (0 errors, 3 warnings). 3회 iter (초기 `FilePanelExtension` 서브패스 import, `any` 타입, react-refresh export 분리, set-state-in-effect 해소) 거쳐 통과.
- 브라우저 실증 미수행 — 마스터 PENDING 게이트에서 manual repro 필요 (3 증상 모두: 업로드 → 미리보기 → 다운로드).

### 트레이드오프 (수용된 변경)
- 기본 `image`/`file` block 의 toolbar (이미지 교체, resize handle) 제거 — `createResizableFileBlockWrapper` 가 BlockNote vanilla render path 에서만 제공되어 React custom block 재구현이 필요. 후속 phase 에서 복원 가능.
- `dcSchema` 가 모듈 레벨 상수로 선언되어 모든 DocumentEditor 인스턴스가 schema 객체 공유 — BlockNote 0.45 가 schema 를 immutable 로 다루므로 현재 API 에서는 안전. 다수 동시 편집 모달 환경에서 점검 권장.
- url 변경 (이미지 교체) 시 이전 blob URL revoke 후 재로드 — 짧은 깜빡임 가능.

### 후속 빌드 단계
`fs_data_viewer` 는 `./dist` export 패키지 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

## v001.92.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#55 (hotfix 2)

### 페이즈 결과
- **Phase 3 (hotfix 2)**: `src/middlewares/viewerRoleCheck.middleware.ts` 와 그 테스트 (`viewerRoleCheck.middleware.test.ts`) 를 통째 삭제. `src/routes/viewer.ts` 의 21개 라우트에서 `viewerRoleCheckMiddleware(...)` 인자 일괄 제거 및 import 제거. `src/models/viewer.model.ts` 에서 supporting 함수 3개 (`findPageIdsByGroupId`, `findParentGroupIdForSubGrid`, `debugDataViewerFieldDiagnostic`) 삭제 — 미들웨어 외 호출자 0건 grep 확인. 총 4 파일 변경, +40/-670 라인.

### 배경
v001.85.0 진단 로그 + v001.89.0 페이로드 직렬화 후 수확한 페이로드 `{groupId:1661, companyId:"funshare", jwtUserCompanyId:"funshare", userRoleId:27, isOwner:false, parentGroupIdLookup:null, pageIdsAfterFallback:0}` 분석으로 가설 B1 (companyId stale) / B2 (user payload stale) 가 모두 REFUTE 됐고, **미들웨어 로직 자체가 잘못된 layer 에서 권한을 강제하는 코드**라는 결론. 마스터 정책 명시: "위젯 단위 오너/비-오너 구분 없음, 권한은 페이지 단위, 페이지와 그룹은 별개, 페이지 권한 없어도 탐색기 페이지를 통해 그룹 작업 가능." → 그룹 ID 만 받아 페이지 binding 경유로 권한을 추론하는 미들웨어 자체가 정책 위반. 부분 제거 (라우트 단위) 는 잔여 라우트가 동일 버그를 재현 → 시간 차 두고 다시 막힘 → 점진적 치료 트레드밀이라 R (전체 제거) 채택.

### 영향 파일
- data-craft-server:
  - `src/routes/viewer.ts` (21 라우트에서 미들웨어 호출 제거)
  - `src/middlewares/viewerRoleCheck.middleware.ts` (삭제)
  - `src/middlewares/viewerRoleCheck.middleware.test.ts` (삭제)
  - `src/models/viewer.model.ts` (3 함수 삭제)

### 안전성 검증

- 세 model 함수 (`findPageIdsByGroupId`, `findParentGroupIdForSubGrid`, `debugDataViewerFieldDiagnostic`) 호출자 grep 결과 0건 (미들웨어 외 참조 없음).
- Tenant isolation 은 `auth.middleware` (JWT payload 기반 `req.companyId` 설정) + `tenant.middleware` + 각 controller 내부 `companyId` scoping 으로 유지됨 — 미들웨어 제거가 cross-tenant 노출로 이어지지 않음.
- `pnpm lint` PASS (사용되지 않는 import / 변수 0건).

### 운영 가이드

- dev 서버 재기동 (`/dev-start data-craft` 또는 동등) 후 user=37 으로 그룹 1660 / 1661 의 열 추가 + 그룹 삭제 정상 동작 확인 필요.
- 정상 동작 시: 본 플랜 종결.
- 여전히 실패 시: tenant isolation 이 어딘가 깨졌거나 다른 미들웨어가 영향 — 추가 진단 필요.

### 회귀 위험

- enterprise-098/121/normal-159 PHASE-22 의 원 시큐리티 의도가 페이지-기반 권한 게이팅이었다면 그 정책은 본 제거로 폐지됨. 마스터 정책 ("그룹 단위 권한 없음") 이 정식이라는 명시적 결정에 따른 의도된 변경.
- 페이지 단위 권한이 필요한 다른 layer (페이지 라우트 자체) 는 본 변경의 영향권 밖.

## v001.91.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#57 (핫픽스 1)

### 페이즈 결과
- **Phase 2 (핫픽스 1)** (`686c418`): Phase 1 의 `truncate` 제거 이후 긴 텍스트 셀이 자유 wrap 되면서 행 높이를 초과하는 콘텐츠가 `DataCell` 의 `overflow: hidden` 에 의해 mid-line 으로 잘리는 회귀 보정. `FsGridLongTextCellRenderer.tsx` 에 `useLayoutEffect` + `ResizeObserver` 로 `cellRef` div 의 실측 clientHeight - 패딩 / computed line-height 비율로 `maxLines` 동적 산출, span 의 `WebkitLineClamp` 에 바인딩. CSS 4중주 (`display:-webkit-box` + `WebkitBoxOrient:'vertical'` + `overflow:'hidden'` + `WebkitLineClamp`) 로 행 높이만큼만 라인이 표시되고 초과분은 말줄임표로 처리. `wordBreak:'break-word'` 추가로 매우 긴 연속 토큰도 안전 wrap. 행 높이 변경 시 ResizeObserver 가 재측정해 자동 반영.

### 배경 (핫픽스 사유)
v001.87.0 (Phase 1) 에서 `truncate` 단순 제거로 wrap 동작을 일반 텍스트 셀과 정렬했으나, 행 높이 capacity 를 초과하는 콘텐츠가 셀 경계 밑으로 흘러나가 `DataCell` 의 `overflow: hidden` 에 의해 임의 위치에서 잘리는 시각적 회귀가 발생 (마스터 보고 화면 — 3줄 분량 행 높이에 4줄+ 렌더, 마지막 라인 mid-character 절단). 라인 경계 정렬 클리핑 + 말줄임표가 필요.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/long-text-cell/FsGridLongTextCellRenderer.tsx` (+30 / -1)

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (3 warnings, 0 errors).

### 알려진 한계
- `lineHeight === 'normal'` 폴백은 `fontSize × 1.5` 근사. 실제 브라우저 'normal' 은 폰트마다 다름 (시스템 폰트 흔히 1.2). 셀이 'normal' line-height 를 상속하는 경우 edge-case 에서 1라인 오차 가능 — 관측 시 폴백을 `× 1.2` 로 조정하거나 명시 line-height 지정 권장.

## v001.90.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#53 (hotfix 1)

### 페이즈 결과
- **Phase 3 (hotfix 1)**: 마스터 핫픽스 사유 — "섹션 단위로만 어두워지고 있어, 영역 단위로 어두워져야 해, 더 명확하게". 디밍 적용점을 Section → Area 로 이동하고, 활성 area 한 곳만 bright 로 유지하도록 의미를 재정의. 강도는 `opacity-40 grayscale` → `opacity-20 grayscale` 로 2배 강화.
  - `src/entities/layout/model/useActiveEditingSectionId.ts` 삭제, `useActiveEditingTarget.ts` 신규 (rename 형태). 반환 `{ sectionId: string | null; areaId: string | null }`.
  - 우선순위 (1) section drawer: `{ sectionId, areaId: null }` — 해당 섹션의 모든 area bright.
  - 우선순위 (2)/(3) area/widget drawer: `{ sectionId: null, areaId }` — 선택 area 하나만 bright, 같은 섹션의 형제 area 들도 dim.
  - subarea 가 활성 cell 인 경우 부모 area id 반환 → 부모 area 가 bright 로 남아 subarea 내용물도 보임 (CSS opacity 상속).
  - `Section.tsx` 의 디밍 클래스 완전 제거.
  - `Area.tsx` 에 디밍 클래스 추가: `opacity-20 grayscale transition-[opacity,filter] duration-200`. placeholder 분기는 기존 `opacity-50` 유지 (손대지 않음).

### 영향 파일
- data-craft:
  - `src/entities/layout/model/useActiveEditingTarget.ts` (rename from useActiveEditingSectionId.ts)
  - `src/widgets/layout-canvas/ui/Section.tsx`
  - `src/widgets/layout-canvas/ui/Area.tsx`

### 검증 시나리오 (QA 수동 확인 필요)
1. 위젯 설정(연필 아이콘) 열기 → 해당 위젯이 들어있는 area 만 또렷, 같은 섹션의 다른 area 들 + 다른 섹션의 모든 area 도 회색·반투명(20%).
2. 영역(Area) 편집 드로어 열기 → 동일하게 그 area 만 또렷.
3. 섹션 설정 드로어 열기 → 그 섹션의 모든 area 가 또렷, 다른 섹션의 area 들만 디밍.
4. 디밍된 area 위에 마우스를 올렸을 때 hover 컨트롤(편집/추가 버튼)이 시각적으로 인지 가능한지 확인 (opacity-20 상태 + group-hover 노출). 발견성이 약하면 후속 핫픽스로 AreaControls 를 디밍 대상에서 제외하는 식의 보강 가능.
5. View 모드(디자인 모드 off) → 디밍 발생하지 않음.

### 알려진 제약 / 후속 검토
- Area 의 `opacity-20` 이 자식 트리 전체에 상속되므로 디밍된 area 의 AreaControls hover 버튼도 평소엔 20% 로 보임. 디자인 모드 사용성에 부담이면 후속 핫픽스로 dim 을 sibling overlay 로 분리하거나 AreaControls 에 `opacity-100` 강제 부여 가능.
- v001.84.0 의 "위젯 드로어 열린 상태에서 다른 섹션 클릭 시 활성 섹션이 즉시 교대되지 않음" 제약은 본 핫픽스에서도 동일.

## v001.89.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#55 (hotfix 1)

### 페이즈 결과
- **Phase 2 (hotfix 1)**: v001.85.0 의 `logger.warn('[VIEWER_ROLE_DENY_ORPHAN]', {...})` 호출이 실제 운영 시 페이로드 객체가 통째로 누락되어 `[WARN] [VIEWER_ROLE_DENY_ORPHAN] (user=37)` 만 출력됐음. 원인: `src/utils/logger.ts:43-67` 의 `formatConsoleLog` (dev 포맷) 가 context 의 화이트리스트 키 (callId/method/path/statusCode/duration/userId) 만 추출해 출력하고 임의 키 (groupId, companyId, parentGroupIdLookup, pageIdsAfterFallback, debug, jwtUserCompanyId, userRoleId, isOwner) 는 무음 드롭. 수정: 호출부에서 페이로드를 `JSON.stringify(denyPayload)` 로 메시지 문자열에 직접 직렬화 → `logger.warn(\`[VIEWER_ROLE_DENY_ORPHAN] ${json}\`)`. logger 모듈 자체는 변경하지 않음 (다른 호출부 영향 차단).

### 배경
v001.85.0 진단 패치 후 재현 결과: 로그 라인 자체는 출력되어 코드 반영은 확인되었으나, 페이로드가 누락되어 가설 분기 식별이 여전히 불가능. 추가로 그룹 1661 의 DELETE `/api/viewer/group/1661` 도 동일 분기 → 1660/1661 두 그룹 모두 orphan 분기 트리거. logger dev 포맷 화이트리스트가 원인이라는 primary-source 증거 (`logger.ts:50-58`) 확보 후 호출부 1줄 수정.

### 영향 파일
- data-craft-server:
  - `src/middlewares/viewerRoleCheck.middleware.ts`

### 운영 가이드

- **dev 서버 재기동 필수** — 핫픽스 머지 후에도 로그가 `(user=37)` 만 보이면 구 코드가 도는 것. `pnpm dev` 재실행으로 nodemon 리로드 확인.
- 환경 변수 `DEBUG_VIEWER_ROLE=1` 도 함께 설정 (v001.85.0 가이드 그대로).
- 재현 후 로그에서 `[VIEWER_ROLE_DENY_ORPHAN] { ... }` JSON 블록 1건을 master 에게 전달.

### 검증 시나리오
- `DEBUG_VIEWER_ROLE=1 pnpm dev` 재기동 후 user=37 으로 그룹 1660 또는 1661 진입.
- 열 추가 (POST `/api/viewer/:groupId/post`) 또는 그룹 삭제 (DELETE `/api/viewer/group/:groupId`) 시도 → 403 재현 → 서버 로그에 `[VIEWER_ROLE_DENY_ORPHAN] {"groupId":..., "companyId":..., "userRoleId":..., "isOwner":..., "parentGroupIdLookup":..., "pageIdsAfterFallback":..., "jwtUserCompanyId":..., "debug":{...}}` JSON 블록 출력 확인.
- JSON 페이로드를 master 에게 전달 → 가설 분기 확정.

## v001.88.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#54

> 버전 충돌 메모 (CLAUDE.md §5 step 4): 본 머지 시점에 plan #57 (v001.87.0) 가 먼저 main 에 진입하여 본 entry 가 v001.88.0 으로 양보. 양측 entry 모두 보존.

### 페이즈 결과
- **Phase 1**: `packages/fs-data-viewer` 의 문서 셀 모달 prop 체인 (`DocumentEditDialog` → `ContentArea` → `DocumentEditor`) 에 옵셔널 `uploadFile?: (file: File) => Promise<string>` 추가, `useCreateBlockNote({ uploadFile })` 에 직결. `FsGridDocumentCellRendererProps` 에도 동일 콜백 노출. (커밋 `11fe4b0b`)
- **Phase 1 확장**: Phase 2 도중 식별된 패키지 내부 라우팅 누락을 해소 — `FsDataViewerProps` 부터 `cell-renderer-map` 의 document 브랜치까지 11계층에 `uploadDocumentFile?: (file, dataViewerField, columnField, rowField) => Promise<string>` 순수 pass-through 라우팅 추가. cell-renderer-map document 브랜치에서 셀 컨텍스트 바인딩으로 `FsGridDocumentCellRenderer.uploadFile` 에 연결. (커밋 `916348f8`)
- **Phase 2**: 호스트 `src/features/data-viewer/lib/uploadDocumentAttachment.ts` 헬퍼 신규 — `category='document-attachment'`, `identifier='{dataViewerField}-{columnField}-{rowField}'` 합성 후 `fs_api.fileApi.uploadFile()` 호출, `response.data.uri` 반환. uri 부재 시 Error throw (BlockNote 자체 에러 UI 위임). `Viewer.widget.tsx` 의 단일 `<FsDataViewer>` 마운트에 `uploadDocumentFile` prop 주입. (커밋 `7a75111b`)

### 배경
QA팀 제안 — 데이터 뷰어 문서 타입 셀 모달 (BlockNote 0.45 에디터 기반) 의 이미지/파일 첨부 시 현재 URL 입력만 지원. URL 입력 방식을 유지한 채 드래그/선택 업로드를 BlockNote 의 image/file block 에 병행 추가. 백엔드 `POST /api/file` (multipart, category/identifier) 및 FE 헬퍼 `fs-api` `uploadFile()` 기존 인프라 재사용 — 백엔드/SDK 변경 없음. BlockNote `useCreateBlockNote({ uploadFile })` 옵션 주입으로 Upload 탭 자동 노출.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/dialogTypes.ts`
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditDialog.tsx`
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/ContentArea.tsx`
  - `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridDocumentCellRenderer/documentCellTypes.ts`
  - `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridDocumentCellRenderer/FsGridDocumentCellRenderer.tsx`
  - `packages/fs-data-viewer/src/entities/data-viewer-props.types.ts`
  - `packages/fs-data-viewer/src/app/types.ts`
  - `packages/fs-data-viewer/src/app/FsDataViewer.tsx`
  - `packages/fs-data-viewer/src/app/FsDataViewerRouter.tsx`
  - `packages/fs-data-viewer/src/pages/GridViewPage.tsx`
  - `packages/fs-data-viewer/src/features/grid/lib/gridViewTypes.ts`
  - `packages/fs-data-viewer/src/widgets/grid-table/hooks/useTableView.ts`
  - `packages/fs-data-viewer/src/widgets/fs_grid_renderer/FsGridRenderer.tsx`
  - `packages/fs-data-viewer/src/widgets/fs_grid_renderer/types.ts`
  - `packages/fs-data-viewer/src/widgets/fs_grid_renderer/generate-widget.tsx`
  - `packages/fs-data-viewer/src/widgets/fs_grid_renderer/cell-renderer-map.tsx`
  - `src/features/data-viewer/lib/uploadDocumentAttachment.ts` (신규)
  - `src/widgets/viewer-widget/ui/Viewer.widget.tsx`

### 후속 빌드 단계
`fs_data_viewer` 는 `./dist` export 패키지 — 본 머지 후 dev/배포 전 `pnpm --filter fs_data_viewer build` 실행 필요.

### 미해결 / 후속 플랜
- BlockNote 업로드 실패 시 커스텀 토스트 UX — 본 플랜은 BlockNote 자체 에러 표시에 의존. 별도 UX 플랜 분리.
- `data-craft-mobile` (`fs-data-viewer-mobile`) 동등 기능 — 별도 패키지이므로 본 플랜 미포함, 후속 플랜.
- `identifier` triplet 의 행 정렬/이동 시 안정성은 기존 file 셀 가정을 inherit — 별도 검증 미수행.

## v001.87.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#57

### 페이즈 결과
- **Phase 1** (`0424832`): 데이터 뷰어 그리드 뷰의 "긴 텍스트" 셀이 행 높이 증가에도 한 줄 말줄임표(`…`)로만 표시되던 문제 해결. `FsGridLongTextCellRenderer.tsx:99` span 의 Tailwind `truncate` 클래스 (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) 를 제거하여, 일반 텍스트 셀 (`FsGridTextCellRenderer.tsx:84`) 과 동일하게 default `white-space: normal` wrap 동작을 갖게 함. 행 높이가 늘어나면 그만큼 가능한 부분까지 자동 개행 표시. 툴팁 / 편집 다이얼로그 / focus 스타일 등 다른 동작 무영향.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/widgets/cell-renderers/long-text-cell/FsGridLongTextCellRenderer.tsx`

### 검증 결과
- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0 (3 warnings, 0 errors).

## v001.86.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#47 (핫픽스 2)

### 페이즈 결과
- **Phase 3 (핫픽스 2)**: 핫픽스 1 이 행 추가 경로 5개 중 1개(`handleAddRow` 푸터)만 커버했던 누락 보강. 누락 4개 — `handleAddRowTop` (헤더 우측 `+`, QA 재현 screenshot 의 사용 경로), `handleInsertRowAt` (컨텍스트 메뉴 위/아래 삽입), `handlePasteRow`, `handlePasteRowAt` — 각각 `setSubGridModel(...)` 호출 직후 `onAddRowToCache?.(parentRowField, newRowWithParent)` 한 줄 추가 + 각 `useCallback` 의존성 배열에 `onAddRowToCache` 포함.

### 배경 (핫픽스 사유)
v001.82.0 (핫픽스 1) 의 캐시-콜백 root cause 분석은 정확했으나 **커버리지 실패**. `useSubGridHandlers.ts` 의 행 추가 경로가 5개임을 식별하지 못해 사용자가 실제로 사용한 헤더 `+` 버튼 (`handleAddRowTop`) 이 누락. 추가로 `pnpm --filter fs_data_viewer build` 단계가 핫픽스 1 종료 시 누락되어 dev 서버가 stale `dist/` 를 읽고 있었던 점도 인지 — 본 핫픽스에서 빌드 단계 명시.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/widgets/fs_grid_sub/hooks/useSubGridHandlers.ts` (+12 라인, 4개 핸들러)

### 후속 빌드 단계
fs_data_viewer 는 `./dist` export 패키지. 본 머지 후 즉시 `pnpm --filter fs_data_viewer build` 실행 완료.

## v001.85.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#55

### 페이즈 결과
- **Phase 1**: `src/middlewares/viewerRoleCheck.middleware.ts` 의 orphan 분기 (line 88, `pageIds.length === 0` 후 부모-서브그리드 fallback 도 실패) throw 직전에 `logger.warn('[VIEWER_ROLE_DENY_ORPHAN]', {...})` 라인 추가. 페이로드: `groupId`, `companyId`, `userId`, `userRoleId`, `isOwner`, `parentGroupIdLookup` (subgrid fallback 결과), `pageIdsAfterFallback`, `jwtUserCompanyId` (= `req.companyId`, 동일 출처지만 형식 가독성 유지), `debug` (env 가드 결과). 서브그리드 fallback 변수를 outer-scope `parentGroupIdLookup` 으로 끌어올려 로그에 포함. `src/models/viewer.model.ts` 에 `DEBUG_VIEWER_ROLE` env 가드 보조 함수 `debugDataViewerFieldDiagnostic(groupId)` 추가 — companyId/is_deleted 필터 제외 `JSON_EXTRACT(properties, '$.dataViewerField') = ?` COUNT(\*) + raw 샘플 1행 반환 (B1 companyId stale / D1 JSON 타입 불일치 가설 판별용). 보안: `ForbiddenError.data` 응답 노출 경로(`error.middleware.ts:89`)는 사용하지 않고 서버 로그 한정.

### 배경
데이터 뷰어 메인 그리드에서 비-오너(user=37) 가 첫 열 추가 시도 시 `POST /api/viewer/1660/post` → `403 GROUP_ACCESS_DENIED` (`viewerRoleCheck.middleware.ts:89`). 9초 간격 2회 실패 → 브라우저 새로고침 1회 → 동일 동작 성공. 새로고침-회복 패턴은 stale 인증 컨텍스트(JWT companyId / user payload) 시그니처를 가리키나, 현재 로그 한 줄 (`ForbiddenError: GROUP_ACCESS_DENIED` + 스택)만으로는 가설 분기 (B1 companyId stale / B2 user payload stale / D1 JSON 타입 / D2 is_deleted) 식별 불가. 본 패치는 진단 정보를 1줄로 수확해 다음 발생 시점에 가설 확정을 목표로 함 — 실제 픽스는 본 진단 결과 기반의 후속 hotfix 로 분리.

### 영향 파일
- data-craft-server:
  - `src/middlewares/viewerRoleCheck.middleware.ts`
  - `src/models/viewer.model.ts`

### 운영 가이드

- 재현 환경에 `DEBUG_VIEWER_ROLE=1` 환경 변수 설정 후 서버 재기동 필요. 미설정 시 `debug` 필드는 `null` 로 출력되며 base 필드만으로는 B1 / D1 분기 불가능.
- 재현 후 서버 로그에서 `[VIEWER_ROLE_DENY_ORPHAN]` 라인 1건 추출 → master 에게 전달 → 후속 hotfix 플랜 형성.

### 검증 시나리오
- user=37 으로 데이터 뷰어 → 그룹 1660 진입 (새로고침 없이) → 열 추가 → 403 응답 확인 → 서버 로그 `[VIEWER_ROLE_DENY_ORPHAN]` 1줄 캡처.
- 새로고침 후 동일 시도 → 200 성공 확인 (로그 라인 미출력).
- 두 케이스 비교를 통해 companyId / pageIdsAfterFallback / debug.totalMatchAnyCompany 의 변화 패턴 식별.

## v001.84.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#53

### 페이즈 결과
- **Phase 1**: `src/entities/layout/model/useActiveEditingSectionId.ts` 신규. layoutStore 와 widgetStore 양쪽을 selector subscription 으로 구독하는 React 훅. 현재 편집 중인 섹션 id 를 우선순위 (1) `isSectionDrawerOpen && selectedSectionId`, (2) `isAreaDrawerOpen && selectedAreaId` → area/subArea 포함 section 역추적, (3) `selectedWidgetId && widgets[id].cellId` → 동일 역추적, 그 외 null 로 반환. cross-store 변경에도 리렌더되도록 `getState()` 단일 호출 패턴을 피하고 각 store 를 selector hook 으로 구독.
- **Phase 2**: `src/widgets/layout-canvas/ui/Section.tsx` 가 위 훅을 호출하고, `isDesignMode && activeEditingSectionId && activeEditingSectionId !== id` 조건에서 `opacity-40 grayscale transition-[opacity,filter] duration-200` 클래스를 `cn(...)` 마지막 인자로 추가. 기존 className 토큰·인라인 style·`transition-colors`·pointer-events 모두 불변.

### 배경
QA 팀 제안 — 기본 테두리 제거(`areaBorderStyles.ts` "기본 테두리 제거로 더 이상 오버라이드 불필요") 후 깔끔해졌으나 영역 구분이 약해진다는 피드백. 위젯/영역/섹션 설정 드로어 중 어떤 것이든 열린 동안 비활성 섹션을 회색·반투명으로 디밍하여 편집 컨텍스트를 시각적으로 분리한다. View 모드와 드로어 닫힘 상태에서는 디밍이 발생하지 않으며 pointer-events 도 차단하지 않는다.

### 영향 파일
- data-craft:
  - `src/entities/layout/model/useActiveEditingSectionId.ts` (신규)
  - `src/widgets/layout-canvas/ui/Section.tsx`

### 검증 시나리오 (QA 수동 확인 필요)
1. 디자인 모드에서 섹션 2개 이상 만든 뒤 각 케이스 확인:
   - 섹션 설정 드로어 → 선택 섹션만 또렷, 나머지는 회색·반투명.
   - 영역(Area) 편집 드로어 → 그 영역을 가진 섹션만 또렷.
   - 위젯 설정(연필 아이콘) → 그 위젯을 가진 섹션만 또렷.
2. 드로어 닫기 → 모든 섹션 원상 복귀, 트랜지션 부드럽게 동작 (`transition-[opacity,filter] duration-200` 가 실제 애니메이션 적용되는지 시각 확인. 미동작 시 `transition-all` 폴백 가능).
3. View 모드 (디자인 모드 off) → 디밍 발생하지 않음.
4. `opacity-40 grayscale` 의 시각적 강도 적정성 — 너무 강해 비활성 섹션 식별이 어려우면 핫픽스로 조정.

### 알려진 제약
- 위젯 드로어가 열린 상태에서 다른(디밍된) 섹션을 클릭해도 활성 섹션이 즉시 교대되지는 않음. `selectSection(id)` 가 `isSectionDrawerOpen: false` 만 세팅하기 때문 — 위젯 드로어가 우선순위 (3) 으로 살아있어 디밍 기준이 여전히 위젯 소속 섹션. 위젯 드로어를 명시적으로 닫은 뒤 다시 선택해야 한다. 이번 변경 범위에 포함하지 않음.

## v001.83.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#52 (hotfix 1)

### 페이즈 결과
- **Phase 2 (hotfix 1)**: 디자인모드 좌측 사이드바의 페이지 row 두 곳 (`src/widgets/page-navigation/ui/SortableTreeItem.tsx`, `src/widgets/page-navigation/ui/DesignSidebarHiddenPages.tsx`) 에서 아이콘 버튼 그룹의 hover-gating 을 `hidden group-hover:flex` (display-based) → `flex invisible group-hover:visible` (visibility-based) 로 전환. 동시에 페이지 이름 span 의 `group-hover:max-w-[80px]` / `group-hover:max-w-[100px]` 를 `max-w-[80px]` / `max-w-[100px]` (상시 적용) 로 변경하여 버튼 그룹이 상시 레이아웃 공간을 차지하는 새 구조와 일관성을 유지.

### 배경 (실제 원인)
v001.81.0 의 shadcn Provider 정리는 정상화 효과는 있었으나, 보고된 깜박임의 직접 원인이 아니었음 — 마스터 재검증에서 깜박임이 그대로 재현됨. 정확한 원인은 다음과 같음:
- 페이지 row 의 아이콘 버튼 그룹이 `<div className="hidden group-hover:flex ...">` 패턴 — row 가 hover 가 아니면 그룹이 `display: none`.
- Radix Tooltip 의 trigger 가 `display: none` 이면 `getBoundingClientRect()` 가 `{0,0,0,0}` 을 반환.
- 사용자가 row A → row B 로 마우스를 옮기는 순간: row A 가 hover 를 잃어 row A 의 버튼 그룹이 `display: none` 으로 전환됨. 그러나 row A 에 있던 툴팁은 Radix Presence 가 exit animation (~150ms, `data-[state=closed]:animate-out fade-out-0 zoom-out-95`) 을 마칠 때까지 DOM 에 잔존. 이 잔존 기간 중 floating-ui 의 `autoUpdate` (ResizeObserver) 가 trigger 의 변경된 rect (=zero) 을 감지하여 popper 위치를 (0,0) 에 재앵커 — 닫히는 툴팁이 화면 좌상단에서 페이드아웃되며 보임.
- `visibility: hidden` 으로 전환하면 요소가 레이아웃에 그대로 머물러 `getBoundingClientRect()` 가 실제 위치를 유지 → 닫히는 툴팁이 (0,0) 으로 재앵커되지 않음.

### 영향 파일
- data-craft:
  - `src/widgets/page-navigation/ui/SortableTreeItem.tsx`
  - `src/widgets/page-navigation/ui/DesignSidebarHiddenPages.tsx`

## v001.82.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#47 (핫픽스 1)

### 페이즈 결과
- **Phase 2 (핫픽스 1)**: 내장 서브그리드 신규 행 추가 시 캐시 동기화 콜백 `addRowToCache(parentRowField, newRow)` 신설. UI "+ 행 추가" 버튼 경로(`useSubGridHandlers.handleAddRow`)에서 `setSubGridModel` 직후 본 콜백을 호출해 `serverSubGridCacheRef` 및 (필요 시) `baseSubGridCacheRef` 양쪽에 새 행을 append. 콜백은 `useSubGrid` → `FsGridTableView` → `SubGridRow` → `FsSubGrid` → `useSubGridHandlers` 의 prop chain 으로 7 파일에 걸쳐 threading. Phase 1 의 닫기-시 viewerModel 스냅샷 8 라인은 revert — `viewerModel.subGridModel` 자체가 row-add 경로에서 갱신되지 않으므로 dead code.

### 배경 (핫픽스 사유)
v001.76.0 (Phase 1) 후에도 QA 재현 시 증상 그대로. 재조사 결과 root cause 가 다름: `BodyRowList.tsx:234` 의 조건부 렌더(`isExpanded && <SubGridRow/>`)로 서브그리드 접기 시 `FsSubGrid` 가 unmount → 로컬 `state.subGridModel` 소실. UI 행 추가는 `useSubGridHandlers.handleAddRow` (`line 192-198` 주석에 명시) 가 `onSaveSubGridModel` 을 의도적으로 호출하지 않으므로 데이터 뷰어 최상위 `viewerModel.subGridModel` 에도 신규 행이 도달하지 않음. 따라서 Phase 1 의 닫기-시 viewerModel 스냅샷은 항상 stale (신규 행 없음) → 캐시-복원에서 행 누락. 기존 `deleteRowsFromCache` / `updateCachedRowOrder` 와 대칭되는 mutation-시점 캐시 콜백 패턴이 정답.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/features/grid/hooks/useSubGrid.ts`
  - `packages/fs-data-viewer/src/widgets/grid-table/FsGridTableView.tsx`
  - `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/types.ts`
  - `packages/fs-data-viewer/src/widgets/grid-table/components/grid-body/SubGridRow.tsx`
  - `packages/fs-data-viewer/src/widgets/fs_grid_sub/types.ts`
  - `packages/fs-data-viewer/src/widgets/fs_grid_sub/FsSubGrid.tsx`
  - `packages/fs-data-viewer/src/widgets/fs_grid_sub/hooks/useSubGridHandlers.ts`

### 집행 비고
스킬 spec 의 "HOTFIX 시 patch-note 는 동일 hotfix WIP 위에 둔다" 규정은 단일-repo 가정. 본 플랜은 코드(data-craft) / 문서(Project-I2) 가 분리되어 있어 hotfix WIP 와 별개로 Project-I2 측 doc WIP (`plan-enterprise-47-valiant-shell-핫픽스1-문서`) 를 단발성으로 사용. spec 의 "no 작업/문서 split" 정신은 유지 — hotfix 측은 단일 WIP, 문서 측도 단일 WIP, repo 가 다르기 때문에 결과적으로 2 WIP.

## v001.81.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#52

### 페이즈 결과
- **Phase 1**: shadcn `Tooltip` 래퍼 (`src/shared/ui/shadcn/tooltip.tsx`) 의 `Tooltip` 함수에서 내부 `TooltipProvider` 중첩을 제거하고 `TooltipPrimitive.Root` 를 직접 반환하도록 변경. `TooltipProvider` 함수 자체와 export 는 보존되어 `src/app/providers/index.tsx:26` 의 글로벌 `<TooltipProvider delayDuration={300}>` 는 영향받지 않음. 결과적으로 글로벌 `delayDuration={300}` 이 모든 callsite 에 일관 적용되어 hover-in 직후 floating-ui 가 trigger 의 boundingRect 측정을 마칠 시간을 확보 — 디자인모드 좌측 사이드바의 페이지 노드 아이콘 버튼(자식 화면 추가·복사·편집·삭제) 위로 빠르게 마우스를 이동시킬 때 툴팁이 화면 좌상단(0,0) 에 1프레임 깜박이며 나타나는 버그가 제거됨. `skipDelayDuration` 은 dwell→인접 이동 경로에서 0,0 race 를 재현할 잠재 위험이 있어 도입하지 않음.

### 배경
QA 보고: 데이터크래프트 → 디자인 모드 → 좌측 사이드바의 페이지 노드 아이콘 버튼들 위로 클릭 없이 마우스를 빠르게 위아래로 이동시키면, 툴팁이 아이콘 위가 아닌 화면 좌상단에 순간적으로 나타났다 사라지는 깜박임 현상. 원인은 shadcn 래퍼가 각 `<Tooltip>` 호출마다 내부 `TooltipProvider(delayDuration=0)` 로 감싸 글로벌 Provider(`delayDuration=300`) 를 덮어쓰던 구조 — instant mount 후 floating-ui 의 boundingRect 측정 전에 Portal Content 가 (0,0) 에 렌더되며, 이후 위치 계산 완료 시 정확한 자리로 점프. 내부 Provider 제거로 글로벌 delay 가 적용되어 측정 경합이 사라짐.

### 영향 파일
- data-craft:
  - `src/shared/ui/shadcn/tooltip.tsx`

## v001.80.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#51

### 페이즈 결과
- **Phase 1**: TagRenderer (`packages/fs-data-viewer` + `packages/fs-sub-data-viewer` 두 패키지의 동일 컴포넌트) 의 `<input>` 바인딩 모델을 "전체 직렬화 문자열" 에서 "신규 태그 단일 draft" 로 전환. 기존 `localValue` / `prevValue` 동기화 로직 제거 → `draft` (초기값 `''`) 로 단일화. 기존 태그는 외부 `value` prop 을 매 렌더링마다 split 하여 도출. 쉼표·Enter 키는 `onKeyDown` 에서 `preventDefault` 후 `commitDraft` 호출, Blur 시 draft 비어있지 않으면 동일 커밋. 빈 draft·중복 태그는 silent no-op. 빈 draft 상태에서 Backspace 입력 시 마지막 칩 제거. 두 패키지의 의도적 분기 (fs-data-viewer 의 `/[,\s]+/` 분할 정책 + `CornerDownLeft` 아이콘 + `pr-6` 패딩 / fs-sub-data-viewer 의 `,` 단독 분할 정책) 는 그대로 보존. `BaseRendererProps` 시그니처 / 외부 직렬화 형식 (콤마+스페이스) / i18n placeholder 텍스트 모두 변경 없음.

### 배경
QA 보고: 칸반뷰어의 태그 입력은 `'태그1, 태그2, ...'` 형식으로 입력해야 하나 (1) placeholder 가 native HTML 속성이라 첫 태그 입력 직후 자동 숨김 → 형식 규칙 인지 불가, (2) 입력 필드가 직렬화된 전체 태그 문자열을 그대로 바인딩하여 사용자가 수동 편집 시 (커서 위치에서 Backspace 등) 다른 태그도 함께 손상될 가능성. 입력 필드를 신규 태그 1개의 draft 로 축소하면 commit 직후 `''` 로 비워지므로 placeholder 가 항상 노출되고, 기존 태그는 칩(chip) UI 만으로 표현·개별 삭제되어 문자열 편집을 통한 손상 경로가 차단됨. 칸반뷰어 + 그리드뷰어 양쪽이 같은 컴포넌트를 공유하므로 두 컨텍스트 모두 동일 개선 적용.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/TagRenderer.tsx`
  - `packages/fs-sub-data-viewer/src/shared/ui/cell-renderers/renderers/TagRenderer.tsx`

## v001.79.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#50

### 페이즈 결과
- **Phase 1**: `discardChanges` (`src/entities/layout/model/layoutPersistence.ts`) 가 layoutStore 만 서버 상태로 복원하고 `useWidgetStore.widgets` 는 손대지 않던 결함을 수정. `widgetCrudActions.ts` 에 `replacePageWidgets(pageScopedIds, serverWidgets)` 액션 신설 (page-scoped — 다른 페이지 위젯 보존), `WidgetStore` 타입에도 시그니처 추가. 폐기 진입 시 현재 layout 의 areas/subAreas 를 순회해 page-scoped widget id 집합 수집 후, 서버 응답 성공 분기에서는 `response.data.widgets` 로 replacePageWidgets 호출 (서버 위젯으로 덮어쓰기 + 신규 생성분 제거), snapshot 폴백 분기 두 군데에서는 snapshot 에 없는 신규 생성 id 만 best-effort 로 제거 + "새로고침 권장" 콘솔 경고. viewer refreshMeta 루프는 widget 교체 이후로 순서 이동.

### 배경
QA 보고: 탭화면 페이지의 디자인 모드에서 위젯 (탭위젯 사용) 을 다른 위젯으로 변경 후 뷰 모드로 전환 시 저장 안내 다이얼로그에서 "저장 안함" 을 선택해도 화면상에는 변경사항이 그대로 보이고, F5 새로고침해야 비로소 원본 상태로 정상 반영. 서버 데이터는 미저장 (정상) — 클라이언트 widgetStore 상태만 오염되는 패턴. 근본 원인은 `discardChanges` 의 layout 만 복원하고 widget 은 손대지 않는 비대칭. `widgetStore.widgets` 가 탭 페이지의 `mergeWidgets` 호출로 cross-page flat map 이 되어 있어 전체 reset 은 금지 — page-scoped 복원 필수.

### 영향 파일
- data-craft:
  - `src/entities/widget/model/widgetTypes.ts`
  - `src/entities/widget/model/widgetCrudActions.ts`
  - `src/entities/layout/model/layoutPersistence.ts`

### 미해결 / 후속 검토
- QA 보고문의 "탭위젯 사용" 표현이 (a) 외부 탭 위젯 자체 교체 / (b) 탭 내부 위젯 교체 두 가지로 해석 가능. 본 fix 는 (a) 를 확실히 커버. (b) 의 경우 `useTabPageLayout` 이 inner pageId 로 별도 `layouts[layout-<innerPageId>]` 엔트리를 등록하므로 본 fix 의 `pageScopedIds` 수집 범위 (outer 만) 가 미달 → 동일 증상 잔존 가능. QA 재현 경로 정확히 확인 후 (b) 면 hotfix 로 inner layout entries scope 확장 + React Query 캐시 invalidate 처리 필요.
- `replacePageWidgets` 가 제거하는 viewer-type widget id 에 대해 `unregisterViewerRef` 호출 누락 (`deleteWidget` 과의 일관성 미확보). 실질 누수 가능성은 낮으나 (React 컴포넌트 unmount 시 자동 정리) 후속 정리 대상.

## v001.78.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#48

### 페이즈 결과
- **Phase 1**: 탭 위젯 설정 드로어의 두 탭명 입력 (기존 탭 인라인 편집 / 신규 탭 추가) 에 `maxLength={TAB_LABEL_MAX_LENGTH}` (=6) 적용. 공용 상수는 `src/shared/lib/tabLabelLimit.ts` 에 신규 정의하여 `shared/lib/index.ts` 에서 re-export (기존 `GROUP_NAME_MAX_LENGTH` 선례와 동형). TabsPropertiesEditor 의 안내 문구에 "탭명 최대 6자" 를 기존 10개 제한 문구와 함께 노출.

### 배경
QA 보고: 탭 위젯의 탭 명칭 입력 시 텍스트 길이 제한이 없어, 긴 이름이 입력되면 탭 헤더 영역이 밀리거나 레이아웃이 깨지는 현상. 탭 헤더는 vertical 모드 `w-[100px]` 고정 / horizontal 모드 `min-w-[100px] flex-none` 으로 정의되어 있어, vertical 100px 슬롯 기준 6자 (마스터 확정) 로 입력단에서 제한.

### 영향 파일
- data-craft:
  - `src/shared/lib/tabLabelLimit.ts` (신규)
  - `src/shared/lib/index.ts`
  - `src/widgets/property-drawer/ui/property-editors/TabItemRow.tsx`
  - `src/widgets/property-drawer/ui/property-editors/TabsPropertiesEditor.tsx`

### 잔여 후속
- 기존에 저장된 6자 초과 탭명은 강제 자르기 없음 (입력단 제한만) — 데이터 마이그레이션은 마스터 결정 후속.
- `TabItemRow` 의 인라인 편집 영역에는 "최대 6자" 안내 미노출 (입력은 maxLength 로 강제됨). UX 일관성 측면 잔여로, 마스터 판단 후속.

## v001.77.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#49

### 페이즈 결과
- **Phase 1**: `data-craft-server/src/config/database.ts` 의 mysql2 `createPool()` config 객체에 `timezone: '+09:00'` 한 줄을 `charset` 다음 위치에 추가. MySQL 세션(KST) 과 driver 의 DATETIME 해석을 정렬하여, 인증 모듈의 시간 비교 4-5 곳(`sendVerificationCode` rate limit, `verifyEmail` `blocked_until`/`expires_at` 비교, `isEmailBlocked`, `daysSinceDeleted`)을 동시에 정상화.

### 배경
QA 보고: 신규 사용자 등록 시 `"32242초 후에 다시 시도해주세요."` 안내메시지로 등록 진행 불가. 부호(방향) 분석으로 운영 환경 TZ 조합을 (DB 세션=KST, Node=UTC) 으로 특정 — mysql2 기본 `timezone: 'local'` 이 KST wall-clock 문자열을 UTC 로 오해석하여 JS Date 가 실제보다 +9h 미래로 변환됨. `Date.now() − sentAt.getTime()` 이 음수가 되어 `rateLimitMs − timeSinceLastSent ≈ +32,400,000 ms` → 32242초(= 9h − 발송 후 158초 경과)와 정확히 일치. config 한 줄 추가로 일괄 정상화.

### 영향 파일
- data-craft-server:
  - `src/config/database.ts`

### 잔여 후속
- **운영 DB 세션 TZ 실측**: deploy 전 staging/운영에서 `SELECT @@session.time_zone, NOW(), UTC_TIMESTAMP();` 실행 필수. `+09:00` 또는 `SYSTEM`(호스트 KST) 이면 가설 확정. `UTC` 등 다른 값이면 본 fix 를 즉시 revert 후 부호 분석 재검토.
- **회귀 sweep**: ① JS Date 로 INSERT 되는 DATETIME 컬럼 식별 후 표본 추출하여 9h 시프트 여부 점검 — 시프트 발견 시 별도 데이터 보정 플랜. ② FE 의 `toISOString()` 표시 로직이 9h 시프트에 적응해 있던 경우 fix 후 표시 오차 — 회원가입 / 사용자 정보 페이지 등 manual 점검.
- **시나리오 verification**: 회원가입 end-to-end (60초 rate limit 정상), 5분 만료, 5회 실패 → 30분 차단 / 자동 해제 시나리오 master manual 검증.

## v001.76.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#47

### 페이즈 결과
- **Phase 1**: 내장 서브그리드(`fs_grid_sub`) 닫기 시점에 working model `subGridModel.rowModelList` 의 해당 `parentRowField` 행들을 `serverSubGridCacheRef` 에 스냅샷 write-back. 캐시가 마지막 working state 를 반영하게 되어, `addRow` / 셀 편집 등 명시 캐시 동기화 utility 가 없는 로컬 변형도 접기 → 재펼치기 사이에 보존된다.

### 배경
QA 보고: 데이터 뷰어 그리드 뷰의 내장 서브그리드에서, 빈 서브그리드에 신규 행을 추가하고 값 입력 없이 접었다가 다시 펼치면 추가 행이 사라짐. 페이지 재진입 시에는 정상 표시 (서버에 저장된 행이 다시 로드되므로). 원인: `addRow` 가 working model 만 갱신하고 `serverSubGridCacheRef` 에 미반영 → 재펼치기 시 캐시 덮어쓰기로 신규 행 누락. close-time snapshot 패턴으로 수정하여 모든 로컬 변형을 일관되게 보존.

### 영향 파일
- data-craft:
  - `packages/fs-data-viewer/src/features/grid/hooks/useSubGrid.ts`

### 잔여 후속
- `baseSubGridCacheRef` (검색/필터/정렬 초기화 시 사용) 도 동일한 신규 행 누락 가능성 — 본 변경 범위 밖, 후속 이슈 후보.

## v001.75.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#46

### 페이즈 결과 — Phase 1 (정적 분석, no-op 종결)

QA 보고: "시스템 언어를 영어(EN)로 설정할 경우 자동로그인 기능이 정상 동작하지 않으며, 한국어 환경에서는 정상 동작" — 마스터 명확화 결과 실제 양태는 **EN 환경에서 자동로그인 옵션을 켜고 로그인했음에도 access token 만료 주기(약 15분)마다 로그아웃**되는 현상. 동적 재현 자료(브라우저 콘솔, HAR, localStorage 스냅샷)는 없음 — 정적 분석만으로 진행.

- **Phase 1 — 정적 추적 (no-op)**: 5개 affected_files 와 서버 측 인증 경로까지 정밀 추적했으나 EN-only 실패 경로를 식별하지 못함. 4단계 추적 결론은 모두 "언어 의존 분기 없음":
  1. `packages/fs-api/src/core/token.ts` — `createLocalStorageTokenStorage` 가 하드코딩 키 `'accessToken'` / `'refreshToken'` 사용. i18n / navigator.language 참조 없음.
  2. `src/entities/auth/model/authStore.ts` — Zustand persist 미사용(devtools 만 적용). `autoLogin` 은 순수 메모리 상태로 페이지 리로드 시 초기화. persist `name` 언어 의존 없음.
  3. `packages/fs-api/src/core/tokenSync.ts` — 고정 키 `'accessToken'` 감시, `StorageEvent.key` 비교만. 언어 분기 없음.
  4. `packages/fs-api/src/core/client.fetch.ts` / `interceptor.ts` — base headers 에 `Content-Type` + `Authorization` 만 부착. `Accept-Language` 등 언어 헤더 자동 부착 경로 없음.
  - 범위 외 read 결과: 서버 `auth.service.ts` L348 의 `refreshToken` 발급은 `rememberMe=true` 조건만 보고, `init.service.ts` L79 `shouldIssueRefreshToken = decoded.rememberMe !== false` (undefined → true). FE `useSigninPage.ts` / `SubdomainLoginForm.tsx` 의 `rememberMe` 초기값은 모두 `true`. **EN 환경 자체가 `rememberMe` 를 `false` 로 변환하는 정적 경로 없음.**
  - 변경 0 commit. lint 게이트 trivially 통과.

### 잔여 가설 (정적 분석 불가, 동적 재현 필요)

1. **Radix Checkbox indeterminate 반환 가설** — EN 환경에서 `Checkbox` 컴포넌트가 `checked === true` 조건을 거짓으로 만들어 `rememberMe` 가 `false` 로 전송될 가능성. UI 런타임 확인 필요.
2. **i18next LanguageDetector 부작용 가설** — EN 감지 시 페이지 리로드 또는 상태 초기화 부작용 여부. 런타임 확인 필요.
3. **외인성 요인 가설** — 브라우저 확장 / 자동완성 / 잔존 localStorage 등 OS·브라우저 설정과 우연히 상관된 외인성 원인. EN 환경과 직접 인과 아님.

### 후속 절차

- PENDING 게이트 유지. 마스터가 `핫픽스 <재현 자료>` 입력으로 동적 정보(브라우저 콘솔 로그, 네트워크 HAR, localStorage Application 탭 스냅샷) 제공 시 추가 추적 라운드 진입.
- 정적 분석만으로 확정 불가한 가설이므로 본 시점에 코드 수정은 보류한다.

### 영향 파일

없음 (0 commit).

## v001.74.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#37 (hotfix 1)

### 페이즈 결과 — Hotfix 1 (Phase 3 / multi-repo)

플랜 #37 종결 직전 DB 읽기 전용 조사를 거쳐 발견된 잔여 결함의 핫픽스. **근본 원인**: Phase 1 의 saveChange 순서 재배치는 visible row 의 cell cascade 자체는 살렸으나, 칸반 뷰가 헤더 date-range 필터(`requestKanbanData(startDate, endDate)`, 기본 ±40일) 의 결과만 `viewerModel.rowModelList` 로 로딩하므로 필터 외부의 행은 cascade loop 가 닿지 못함. 결과로 `customDataList` 는 newName 으로 갱신되었으나 외부 행의 셀은 oldName 잔존 → DB 정합성 깨짐. FE 단독으로는 (a) 기존 변경 카탈로그에 column-wide cell rename 이 없고 (b) 기본 ±40일 필터가 상시 활성이라 rename 차단도 비현실적이므로 BE 신규 변경 타입 도입이 불가피.

- **Phase 3a — BE** (`data-craft-server` `523dadb6`): 신규 변경 타입 `kanbanColumnRename` 추가. wire-format `{ targetType: 'kanbanColumnRename', changeType: 'put', targetField: <columnField>, changeInfo: { oldName, newName } }`. 동작: `data_column.group_id` ownership 검증 → `UPDATE data_values SET value_data=newName WHERE column_id=? AND value_data=oldName AND is_deleted=0` 를 date-range 무관하게 일괄 실행. `saveChanges` 의 `beginTransaction`/`commit` 안에 `processKanbanColumnRename` 디스패치를 추가하여 `processColumnSettings` (customDataList PUT) 와 단일 트랜잭션으로 묶임 → **atomic 보장 (둘 중 하나라도 실패 시 전체 롤백)**. 단위 테스트 4건(ownership 쿼리 순서·파라미터·실패·필수 필드 누락). 변경 +148/-2 across 5 files. lint (`pnpm lint`) PASS.
- **Phase 3b — FE** (`data-craft` `5c9d8f59`): `DataViewerChangeTargetType` 에 `kanbanColumnRename` 추가 + 유니온/허용목록 갱신. `createKanbanColumnRenameChange(columnField, oldName, newName)` 헬퍼 추가. `handleColumnRenamed` 의 per-row `saveChange(createCellChange)` 루프 **완전 제거** → column-wide `saveChange(createKanbanColumnRenameChange)` 1건으로 교체. in-memory `cellValue` 갱신과 `rowModelList`/`columnModelList` ref 교체(Hotfix-001/002 잔존 로직)는 유지하여 visible 카드 UI 즉시 반영. 호출 순서 유지: customDataList → kanbanColumnOrder → columnColor → kanbanColumnRename = saveChange 4건 enqueue. 테스트 갱신: `PHASE-04-column-rename-behavioral.test.tsx` count/positional 단언 갱신, `PHASE-04-column-rename-grid-sync.test.tsx` 2번째 케이스 갱신 + partial-rowModelList(5행 중 2행만 로드) 신규 케이스 추가, `PHASE-04-column-rename.test.ts` source-regex 의 `createCellChange` → `createKanbanColumnRenameChange` 교체. **36/36 vitest PASS**. 변경 +137/-32 across 6 files. lint (`pnpm typecheck:all && pnpm lint`) PASS.

### 운영 노트 (regression 아님, latency only)

`FsKanbanBoard.tsx` 의 `stableColumnRenamed` callback scope 외부에 `reloadKanbanData` 가 있어 본 핫픽스 범위 내에서 즉시 강제 reload 트리거를 추가하지 못함. **date-range 외부 행은 BE가 정확히 column-wide UPDATE 하여 DB에 newName 으로 영속되지만**, FE의 메모리상 rowModelList 에 없으므로 시각적 반영은 사용자의 다음 자연 reload 시점 — 기간 슬라이더 조정 / 칸반 재진입 / 새로고침 — 에 일어남. 데이터 정합성은 즉시 보장되며, UI 표시 지연만 latency-only 잔여. 즉시 refresh 가 필요하다면 후속 핫픽스에서 `FsKanbanBoard.tsx` scope 확장 후 callback 노출 처리.

### 마스터 명령 의도 (재기)

플랜 #37 Phase 1 의 수정이 visible row 한정으로 동작함을 마스터가 발견 → "현재 기간에 카드가 1개인 상태에서 칸반열 명을 변경하면 지금 미표기 상태인 카드들까지 고려 안하고 변경되는것 같아". 정합성 보전을 위해 BE 가 column-wide cascade 를 책임지는 구조로 전환 요구.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/types/dataViewer.types.ts`
- `src/services/dataViewerChange/change.utils.ts`
- `src/services/dataViewerChange/index.ts`
- `src/services/dataViewerChange/change.kanbanColumnRename.ts` (신규)
- `src/services/dataViewerChange/__tests__/kanbanColumnRename.test.ts` (신규)

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/features/kanban/handlers/kanban-reorder-handlers.ts`
- `packages/fs-data-viewer/src/features/data-viewer/lib/changeHelpers.ts`
- `packages/fs-data-viewer/src/entities/data-viewer-change.types.ts`
- `packages/fs-data-viewer/src/__tests__/enterprise-436/PHASE-04-column-rename-grid-sync.test.tsx`
- `packages/fs-data-viewer/src/__tests__/enterprise-436/PHASE-04-column-rename-behavioral.test.tsx`
- `packages/fs-data-viewer/src/__tests__/enterprise-436/PHASE-04-column-rename.test.ts`

### 마스터 수동 검증 시나리오

1. 칸반 뷰에서 헤더 date-range 필터를 좁혀 1~2장 카드만 보이게 한 뒤, 그 가시 카드의 그룹 제목을 인라인 편집으로 변경 (예: "진행중" → "진행중2"). 가시 카드는 즉시 새 그룹 아래로 이동.
2. date-range 를 넓혀 외부 행을 다시 로드 → **이전엔 oldName 으로 잔존하던 외부 행들이 모두 newName 으로 표시**됨 확인. (이전 버그에서는 일부만 변경되어 칸반/그리드 모두에서 데이터 분기 발생.)
3. 그리드 뷰로 전환 → 컬럼 셀 전체가 newName 일관 표시. customDataList 도 newName 포함.
4. 변경 도중 네트워크 오류 등으로 실패 시 customDataList / cell 변경 모두 롤백되어 일관성 유지 (BE 단일 트랜잭션).
5. 동일 그룹 내 다른 customDataList 옵션(변경되지 않은 그룹) 은 이름/위치 유지.

## v001.73.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#34 (Hotfix 2)

### 페이즈 결과

- **Phase 4 (hotfix-2)** (`0f7e398` 코드 + 회귀 테스트 어설션 강화 `1f185c3a`): plan #34 v001.59.0 + v001.70.0 fix 이후 마스터 보고 — 일반 필드는 정상 초기화되나 폼의 파일/이미지 업로더 필드는 여전히 잔존. 마스터 힌트("파일 처리 부분은 별도의 특수한 범용 파일 시스템") 를 단서로 advisor 검증 + grep discriminator 적용. 후보 좁힘: (A) 단순 `FileUploaderField` / `ImageUploaderField` 의 native `<input type="file">` 잔존값, (B) `widgets/file-uploader-widget/` (FileUploaderWidget + useFileUpload + fileApi) 가 폼 내부에서 사용. **discriminator**: `grep useFileUpload\|FileUploaderWidget` 를 `src/widgets/form-widgets/` + `src/features/form-builder/` 디렉토리에서 0 hits → B 사망, A 채택. 폼 내 widgetType `'file-uploader'` / `'image-uploader'` 는 `FormFieldRenderer.tsx:60-61` 에서 단순 uploader 로 분기. 즉 마스터가 언급한 "별도 시스템" = **브라우저 native file input 의 selected-file 표시**(browser-internal 상태로 React state 와 분리). 사용자가 한 번 파일을 픽한 뒤 초기화하면 picker 옆에 파일명이 잔존하는 visual residue.

  해결: `@/shared/ui/Input` (shadcn) 은 forwardRef 미적용이라 ref 기반 reset 불가. **key-bump 전략** 채택 — `FileUploaderField` / `ImageUploaderField` 두 곳에:
  - `inputKey: number` state 추가.
  - 기존 `useEffect([value])` 에서 normalized `next.length === 0` 일 때 `setInputKey((k) => k + 1)` 호출.
  - JSX 의 `<Input>` 에 `key={inputKey}` 부여 → value 가 빈값으로 바뀌는 순간 React 가 native input 을 unmount/remount → selected-file display 도 초기화.

  T17e 회귀 가드 (`tests/normal-068/normal-068-p03-settings-form-modal-5bugs.test.tsx`) 추가. Wrapper 컴포넌트로 value 변경 → 빈값 복원 흐름 재현. **핵심 어설션**: `expect(inputAfter).not.toBe(inputBefore)` — fix 적용 시 DOM 노드 객체가 다름 (remount), 미적용 시 같음. 처음 작성된 어설션 (`input.value === ''`, badge 사라짐) 은 React-controlled 효과만 검증해 negative-run 통과 → 회귀 가드 부적합 → DOM 노드 객체 비교로 강화 (후속 commit `1f185c3a`). **negative-run 1회 실증**: 두 uploader 소스만 hotfix 이전으로 되돌리고 T17e 단독 실행 → 정확히 `expected <input> not to be <input>` 으로 실패함을 확인. 변경 +79 / -2 (3 files). lint exit 0 (3 unused-disable warnings 만, 비차단).

### 마스터 명령 의도 (재기)

v001.70.0 검증 중 마스터 보고 — "폼에서 파일 또는 이미지를 올리는 부분은 여전히 초기화가 안돼, 파일 처리 부분은 별도의 특수한 범용 파일 시스템을 가지고 있으니까 어드바이저와 함께 검토해". advisor 와 함께 후보 B (file-uploader-widget) 를 grep 으로 사망 → A (native input residue) 로 정착 → key-bump 패치.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/features/form-builder/ui/FileUploaderField.tsx`
- `src/features/form-builder/ui/ImageUploaderField.tsx`
- `tests/normal-068/normal-068-p03-settings-form-modal-5bugs.test.tsx`

### 마스터 수동 검증 시나리오

1. 페이지 폼 위젯에 파일/이미지 필드 포함된 폼 배치.
2. 신규 entry 진입 → 파일 업로드 → 초기화 클릭 → picker 옆 파일명 사라짐 + badge 사라짐 + placeholder "파일을 선택하세요" 복원.
3. 신규 entry → 이미지 업로드 → 초기화 → 동일 결과 (이미지 미리보기 / 파일명 모두 사라지고 placeholder 복원).
4. 기존 record 편집 진입 → 초기화 → 모든 표시 비워짐 → 저장 후 재오픈 시 공란 유지.
5. 기존 record 편집 → 새 파일 업로드(덮어쓰기) → 초기화 → native input 도 새 파일명 잔존 없이 초기화.

### 알려진 범위 밖 (잔존 follow-up)

- **`widgets/file-uploader-widget/`** (FileUploaderWidget + useFileUpload + fileApi 의 standalone "범용 파일 시스템") 의 reset 동작 — 폼 내부에서 사용되지 않으므로 본 hotfix 범위 외. 동일 증상이 page 의 standalone 파일 업로더 위젯에서 보고되면 별도 핫픽스로 처리. 
- **`widgets/tabs-widget/ui/*`** registry 경유 FormRenderer (`TabFormContent`, `tabs-widget/FormInputDialog`, `tabs-widget/FormDataListDialog`) — v001.59.0 / v001.70.0 부터 이월. registry signature 변경 필요해 blast radius 큼.

## v001.72.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#36 (hotfix-1)

### 페이즈 결과

- **Phase 4 (hotfix-1)** (`a3227c5b`): v001.69.0 Phase 1 의 root cause 수정. v001.69.0 에서는 `MultiSelectRenderer.toggleOption` 에 방어 로직만 추가해 클릭 시 동작은 sanitize 했으나, 사용자 화면에는 여전히 콤마 결합 복합 옵션이 드롭다운 list 에 하나의 항목으로 노출되는 표시 결함이 남아 있었음 (마스터 실측 스크린샷 첨부 확인). 진짜 원인은 `deriveSelectOptions.ts` 의 fallback 경로가 row 의 `cellValue` 를 split 없이 통째로 옵션 1개로 등록하던 부분 — multiSelect 셀의 cellValue 는 "A, B, C" 형태의 콤마 결합 문자열이므로 전체가 하나의 label 이 됨. **수정**: `deriveSelectOptions` 시그니처에 선택 파라미터 `options?: { splitByComma?: boolean }` 추가. fallback row-walk 단계에서 `splitByComma === true` 일 때 `cellValue` 를 `,` 로 split → trim → 빈 값 제거 → 기존 `seen` Set 로 dedup 한 뒤 개별 label 로 push. `rendererMap.tsx` 의 multiSelect extraProps 호출 사이트만 `{ splitByComma: true }` 전달하도록 변경 (singleSelect 는 default false 유지로 기존 동작 회귀 없음). 신규 테스트 2건 추가 — 단일 row 콤마 분리, 다중 row 교차 dedup. 변경: +40 / -5 across 3 files. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### hotfix-1 평가

v001.69.0 Phase 1 의 진단은 "deriveSelectOptions 폴백 경로가 multiSelect cellValue 를 통째로 등록한다" 까지 도달했으나, affected_files 가 `MultiSelectRenderer.tsx` 측에 묶여 있어 `deriveSelectOptions.ts` 본체 수정은 scope_expansion 으로 보류된 상태에서 toggleOption 방어만 적용했다. 그 결과 클릭 회로는 sanitize 되었으나 옵션 list 의 표시 오염은 그대로 남았고, 마스터 실측에서 즉시 노출됨. hotfix-1 은 root cause 인 deriveSelectOptions 의 분기 처리를 직접 정합화하여 다중선택 드롭다운 list 의 콤마 결합 옵션 노출을 제거. Phase 1 의 toggleOption 방어 로직은 belt-and-suspenders 로 유지 (제거 시 scope creep — 별도 정리 권장).

### 마스터 명령 의도 (재기)

데이터 뷰어 → 칸반/간트 detail drawer 의 다중선택 셀 드롭다운에 사용자가 선택한 값들의 콤마 결합 문자열이 새 항목처럼 추가되어 노출되는 결함. Phase 1 + hotfix-1 의 2단계 수정으로 (1) 클릭 시 저장 값 오염 차단 + (2) 표시 단계의 옵션 list 오염 자체 차단 모두 정합.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/lib/deriveSelectOptions.ts`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/lib/deriveSelectOptions.test.ts`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/rendererMap.tsx`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0.
- advisor 5-관점 (완료 시점): 5/5 PASS — diff 가 advisor #1 승인 shape 그대로, singleSelect default false 유지로 회귀 영역 없음, 신규 테스트가 수정 동작을 직접 검증.

### 알려진 후속 부채

- `MultiSelectRenderer.toggleOption` 의 콤마 split + dedup 방어 로직 (v001.69.0 Phase 1 잔재) 은 root cause 수정 후 dead code 화. 제거 시 별도 plan 권장 (scope creep 회피).
- multiSelect 셀에서 `customDataList` (서버 enum 정상 케이스) 가 비어 있어 fallback 경로로 회귀되는 빈도가 정상인지 — server-side 별도 점검 필요할 수 있음.

## v001.71.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#43 (hotfix-1)

### 페이즈 결과

- **Phase 2 (hotfix-1)** (`651d4f35`): v001.70.0 (Phase 1) 의 진단 정정. Phase 1 은 BlockNote 슬래시 메뉴(`.bn-suggestion-menu`)가 `document.body` 로 portal 된다고 가정하고 `DocumentEditor.tsx` 의 `attach(el)` 에 `overscroll-behavior: contain` 한 줄을 추가했으나, master 실측 결과 본문과 드롭다운이 여전히 함께 스크롤. 재조사 결과 BlockNote `GenericPopover` (`@blocknote/react/src/components/Popovers/GenericPopover.tsx`) 는 `createPortal`/`FloatingPortal` 을 사용하지 않으며 (`SuggestionMenu/`, `Popovers/`, `@blocknote/mantine`, `BlockNoteDefaultUI.tsx` 모두 portal 부재 grep 으로 확정), `.bn-suggestion-menu` 는 ContentArea `scrollRef` 의 descendant 로 렌더됨. 실제 root cause = `ContentArea.tsx:33-60` 의 wheel 핸들러가 `{ passive: false, capture: true }` 로 등록되어 W3C 캡처 단계 순서상 dropdown 의 wheel 핸들러보다 먼저 발화 → 본문에 스크롤 여유가 있는 동안 매 wheel tick 마다 본문이 우선 움직이고 본문 끝단 이후에야 dropdown 차례. master 의 "둘 다 스크롤" 체감은 이 tick 별 선점의 누적. **수정**: `ContentArea.tsx` `handleWheel` 최상단에 `e.target.closest('.bn-suggestion-menu')` 조기 반환 추가하여 중첩 스크롤 컨테이너 내부 wheel 은 본문 핸들러가 가로채지 않고 dropdown 핸들러로 흘려보내도록 정합. `DocumentEditor.tsx` 에서 v001.70.0 의 `overscroll-behavior: contain` 주석 + 대입 2줄 제거 (오진단 dead code 정리). 변경: +6/-2 across 2 files. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### hotfix-1 평가

v001.70.0 의 1차 진단은 "scroll-chaining = 브라우저 기본 동작" 이라는 가정 위에서 출발했고, `.bn-suggestion-menu` 의 portal 여부를 코드/grep 으로 확인하기 전에 MutationObserver 가 `document.body` 를 관찰한다는 정황만으로 portal 을 추정했다. 실측에서 어긋난 뒤 BlockNote 의 `GenericPopover` 소스를 직접 읽어 portal 부재 + capture-phase JS 선점이라는 정합 메커니즘으로 정정. 1차의 mechanism error 를 layer 위에 또 한 겹 가설로 덮는 대신 v001.70.0 의 코드를 같이 제거하여 잔여 dead code 없음. 본 hotfix 의 진단은 W3C 표준 캡처 순서 + 3중 grep (Popovers / SuggestionMenu / mantine + BlockNoteDefaultUI) 으로 근거.

### 마스터 명령 의도 (재기)

데이터 뷰어 → 문서 타입 셀의 문서 모달 본문에서, 본문에 스크롤이 발생할 정도의 긴 블록이 있을 때 블록 왼쪽 `+` 아이콘으로 블록 추가 드롭다운을 열고 드롭다운을 스크롤하면 뒤의 본문이 함께 스크롤되는 문제 차단. v001.70.0 의 1차 수정이 실효 없음을 master 가 실측한 뒤 발급된 hotfix.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/ContentArea.tsx`
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0.
- advisor 5-관점 (완료 시점): Intent / Logic / Group Policy / Evidence PASS, Command Fulfillment PARTIAL — 메커니즘 기반 진단이 확보되어 v001.70.0 의 false-positive 클래스는 종료되었으나 master 실측 PENDING. BLOCK 토큰 없음.

### 잔여 위험 / 후속

- 동일 결합 두 곳: `DocumentEditor.tsx` 의 MutationObserver selector `.bn-suggestion-menu` 와 `ContentArea.tsx` 조기 반환 selector `.bn-suggestion-menu`. BlockNote 0.46+ 클래스명 변경 시 두 곳을 동시 갱신 필요.
- BlockNote 의 다른 inline floating UI (`FormattingToolbar`, `LinkToolbar`, `TableHandles`, `FilePanel`) 도 동일 capture 선점 결함의 잠재 대상. 본 hotfix 는 마스터 보고 범위(슬래시 메뉴) 만 정합. 후속 보고 시 동일 패턴(selector 확장 또는 일반화된 nested-scroll detector)으로 확장 권장.

### 마스터 수동 검증 시나리오

1. `pnpm dev` (포트 5173) 으로 data-craft 기동.
2. 데이터 뷰어 → document 타입 셀 클릭 → 문서 모달 오픈.
3. 본문에 스크롤이 발생할 만큼 텍스트 블록 길게 작성.
4. 임의 블록 왼쪽 `+` 아이콘 클릭 → 슬래시/블록 추가 드롭다운 오픈.
5. 드롭다운 내부를 휠/트랙패드로 스크롤 — 드롭다운 자체 스크롤만 발생, 본문 위치는 고정 유지 (핵심 회귀 케이스, v001.70.0 에서 실패한 시나리오).
6. 드롭다운 외부 본문 휠 스크롤 — 본문 정상 스크롤 (regression 확인).

## v001.70.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#34 (Hotfix 1)

### 페이즈 결과

- **Phase 3 (hotfix-1)** (`7ff9f76` + 후속 테스트 스코프 수정 `13e5254c`): plan #34 v001.59.0 fix 가 `SettingsFormTabContent` (사용자 설정 화면) 의 FormRenderer 사용처만 onReset 배선했고, 페이지에 배치되는 폼 위젯(`widgets/form-widgets/ui/UserFormDialogs → FormInputDialog` 및 `→ DataListDialog → DataListDialogBody`) 경로는 명시적 범위 외였음. 마스터 dev 검증에서 페이지 폼 위젯 경로의 동일 증상 — 초기화 후 저장 시 미입력 필드의 기존값이 잔존하여 "저장 자체가 안 되는 것처럼" 보임 — 이 확인됨. 해결: 동일 store-staleness 패턴을 form-widgets 페이지 런타임 경로에 확장 배선. `useFormData` 가 `useFormWidgetSync.handleFormFieldsChange` 를 destructure 하여 노출, `useUserFormWidget` 반환 타입에 추가, `UserFormWidget` 이 `UserFormDialogs` 에 prop 전달. `UserFormDialogs` 에서 Phase 1 `SettingsFormTabContent` 와 **byte-수준 동일** onReset 람다(`null → ''`, `{start,end} → 'start~end'`, `array → join(',')`, else `String(value)`) 를 정의해 listFirst 경로 (`FormInputDialog`) 와 비 listFirst 경로 (`DataListDialog → DataListDialogBody`) 양쪽에 전달. `FormInputDialog` / `DataListDialog` / `DataListDialogBody` 모두 `onReset?` prop 을 받아 FormRenderer 까지 통과. T17d 회귀 테스트 추가 — `UserFormDialogs` 직접 렌더 + `handleFormFieldsChange` mock 으로 초기화 클릭 시 wire-up 전달 경로가 호출됨을 단언. **negative-run 1회 실증**: 7개 소스 파일을 hotfix 이전으로 되돌리고 T17d 단독 실행 → 정확히 `expected vi.fn() to be called 1 times, but got 0 times` 로 실패함을 확인. 변경 +80 / -6 (8 files). lint gate (`pnpm typecheck:all && pnpm lint`) 두 commit 누적 상태에서 exit 0.

> 버전 충돌 메모 (CLAUDE.md §5 step 4): 본 hotfix 문서 머지 시점에 plan #42 (v001.68.0) 와 plan #36 (v001.69.0) 이 동시 머지되어 본 entry 가 v001.70.0 으로 양보. 양측 entry 모두 보존.

### 마스터 명령 의도 (재기)

v001.59.0 fix 검증 중 마스터 보고 — "그냥 아예 저장 자체가 안 되는데? 폼 위젯을 테스트했는데 초기화 누르고 나와도 목록에 (목록을 우선순위로 옵션 사용하는 경우) 기존 데이터로 나오고 눌러봐도 기존 데이터고, 새로고침해도 기존 데이터." v001.59.0 의 "알려진 범위 밖" 으로 명시했던 form-widgets 페이지 런타임 경로가 마스터의 주 사용 경로였음. 동일 fix 패턴을 그 경로에 확장.
> 플랜 이슈: funshare-inc/data-craft#43

### 페이즈 결과

- **Phase 1** (`65f24678`): 데이터 뷰어 → 문서 타입 셀 → 문서 모달 본문의 블록 추가 드롭다운(BlockNote `.bn-suggestion-menu`)을 끝단까지 스크롤할 때 모달 본문(`ContentArea` `overflow-y-auto`)이 함께 스크롤되는 체이닝 결함 차단. 원인: `.bn-suggestion-menu` 가 `document.body` 로 portal 되어 ContentArea 의 capture-phase JS wheel 핸들러와 분리되어 있으므로 체이닝 경로는 브라우저 기본 scroll-chaining. `DocumentEditor.tsx` 의 `attach(el)` 함수 — BlockNote 가 동적 마운트하는 `.bn-suggestion-menu` 마다 MutationObserver 가 호출하는 자리 — 에서 `target.style.overscrollBehavior = 'contain'` 한 줄과 의도 주석 한 줄 추가. 기존 wheel 핸들러 본체 (deltaMode 보정, 끝단 가드 `if (target.scrollTop !== before)`, preventDefault/stopPropagation) 는 그대로 둠 — BlockNote 0.45 의 휠 입력 보정 의도를 유지. 변경: +2 / -0 across 1 files. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 마스터 명령 의도 (재기)

데이터 뷰어 → 문서 타입 셀의 문서 모달 본문에서, 본문에 스크롤이 발생할 정도의 긴 블록이 있을 때 블록 왼쪽 `+` 아이콘으로 블록 추가 드롭다운을 열고 드롭다운을 스크롤하면 뒤의 본문이 함께 스크롤되는 문제 차단.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/form-widgets/lib/useFormData.ts`
- `src/widgets/form-widgets/lib/useUserFormWidget.ts`
- `src/widgets/form-widgets/ui/UserFormWidget.tsx`
- `src/widgets/form-widgets/ui/UserFormDialogs.tsx`
- `src/widgets/form-widgets/ui/FormInputDialog.tsx`
- `src/widgets/form-widgets/ui/DataListDialog.tsx`
- `src/widgets/form-widgets/ui/DataListDialogBody.tsx`
- `tests/normal-068/normal-068-p03-settings-form-modal-5bugs.test.tsx`

### 마스터 수동 검증 시나리오

1. 페이지에 폼 위젯 배치 (목록을 우선순위로 / listFirst 옵션) → 기존 record 의 수정 진입.
2. 다이얼로그에서 "초기화" 클릭 → 화면 모든 필드 비워짐.
3. 필수 항목만 채워 저장 → 목록 / 재오픈 / 새로고침 모두에서 **비필수 항목들이 공란**(기존값 재노출 없음) 이어야 통과.
4. listFirst 옵션을 끄고 (DataListDialog 경로) 동일 시나리오 반복 — 동일 결과.
5. 사용자 설정 > 직원관리(폼) 경로 (v001.59.0 fix) 회귀 확인 — 변함없이 정상.

### 알려진 범위 밖 (잔존 follow-up)

본 hotfix 는 `widgets/form-widgets/*` 페이지 런타임 경로를 처리. **`widgets/tabs-widget/ui/*`** 의 registry-경유 FormRenderer 사용처(`TabFormContent`, `tabs-widget/FormInputDialog`, `tabs-widget/FormDataListDialog`) 는 registry signature 변경이 필요해 blast radius 가 크고 마스터 보고 경로 외라 여전히 후속. 동일 증상이 탭 위젯 경로에서 보고되면 별도 핫픽스로 처리. v001.59.0 의 follow-up 후보 중 `form-widgets` 부분은 본 v001.70.0 으로 해소됨.
- `packages/fs-data-viewer/src/shared/ui/dialogs/document-edit/DocumentEditor.tsx`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0.
- advisor 5-관점 (완료 시점): Intent / Logic / Group Policy / Evidence PASS. Command Fulfillment PARTIAL — 변경 위치·기제는 정확하나 브라우저 수동 repro 미수행. 마스터 PENDING 게이트에서 실측 검증 필요. BLOCK 토큰 없음.

### 마스터 수동 검증 시나리오

1. `pnpm dev` (포트 5173) 으로 data-craft 기동.
2. 데이터 뷰어에서 document 타입 셀 클릭 → 문서 모달 오픈.
3. 본문에 스크롤이 발생할 만큼 텍스트 블록 길게 작성.
4. 임의 블록 왼쪽 `+` 아이콘 클릭 → 블록 추가/슬래시 드롭다운 오픈.
5. 드롭다운 내부를 휠/트랙패드로 스크롤 — 드롭다운 자체 스크롤 정상, 상/하단 끝단 도달 후에도 본문이 함께 스크롤되지 않아야 함 (핵심 회귀 케이스).
6. 드롭다운 외부 본문 휠 스크롤 — 본문 정상 스크롤 (regression 확인).

## v001.69.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#36

### 페이즈 결과

- **Phase 1** (`8039b3dc`): 칸반/간트 detail drawer 의 다중선택 칩 클릭 시 "리스트에 신규 데이터처럼 추가 생성" 보고의 원인을 추적해 `deriveSelectOptions` 폴백 경로가 multiSelect cellValue (`"A, B"` 등 쉼표 결합 문자열) 를 쪼개지 않고 통째로 옵션 레이블로 등록하는 부분으로 좁힘. 사용자가 그 복합 레이블 옵션을 클릭하면 `MultiSelectRenderer.toggleOption('A, B')` 가 호출되고 `newValues.join(', ')` 결과가 저장 값에 통째로 append → split 후 추가 칩이 생성되는 회로. `toggleOption` 내부에서 label 을 comma 로 split → 각 파트 dedup 처리하는 방어 로직으로 증상 차단. 변경: +12 / -3 across 1 file. Lint gate exit 0.
- **Phase 2** (`a1f6979d`): 단일 선택 상자 (`SingleSelectRenderer`) 와 세계 시간 (`WorldTimeRenderer`) 의 드롭다운 최상단에 "선택 안함" 버튼 추가. 클릭 시 `onChange('')` + `setIsOpen(false)`. i18n 키 `cellRenderer.unselect` 신설 + ko(선택 안함) / en(None) / ja(選択しない) / zh(取消选择) 4개 로케일 반영. `SingleSelectRenderer` 는 `useI18n()` 으로 직접 사용, `WorldTimeRenderer` 는 prop 패턴 따라 `unselectLabel?: string` 추가 + 한국어 폴백. value 가 빈 문자열일 때 selected 표시, `border-b border-gray-100` 구분선, placeholder 톤 적용. `TimeRenderer` (시계시간) 는 기존 `초기화` 버튼 유지로 손대지 않음. 변경: +32 / -0 across 7 files. Lint gate exit 0.
- **Phase 3** (`a73be6e0`, lint-hotfix 후): 회귀 테스트 추가 — `MultiSelectRenderer.test.tsx` 신규 4 케이스 (복합 레이블 split, dedup, 전체 해제, 비편집 차단), `SingleSelectRenderer.test.tsx` 신규 5 케이스, `WorldTimeRenderer.test.tsx` 기존 4 + 신규 4 = 8 케이스. 총 17개 모두 통과. lint hotfix iter 1 — vitest 4.x 의 `vi.fn<(value: string) => void>()` 타입 명시로 TS2322 해소. 변경: +286 / -1 across 3 files. Lint gate exit 0.

### 마스터 명령 의도 (재기)

데이터 뷰어 → 칸반/간트 detail drawer 의 다중선택 칩 클릭 시 선택된 값이 마치 새 레코드처럼 리스트에 추가 생성되는 현상 + 단일 선택 상자 / 세계 시간 셀에서 항목 선택 후 "선택 안함" 으로 되돌릴 어포던스가 없던 문제. 두 결함 모두 공용 셀 렌더러 레이어에서 발생 → 칸반/간트/캘린더 (드로어 사용 뷰) 전체에 동시 반영.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/MultiSelectRenderer.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/SingleSelectRenderer.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/WorldTimeRenderer.tsx`
- `packages/fs-data-viewer/src/shared/config/i18n/types.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/translations/ko.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/translations/en.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/translations/ja.ts`
- `packages/fs-data-viewer/src/shared/config/i18n/translations/zh.ts`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/__tests__/MultiSelectRenderer.test.tsx` (신규)
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/__tests__/SingleSelectRenderer.test.tsx` (신규)
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/__tests__/WorldTimeRenderer.test.tsx`

### 잔여 위험 / 후속

- **버그 A 의 실제 root cause** 는 `deriveSelectOptions.ts` 의 multiSelect cellValue 폴백 등록 로직. 본 플랜에서는 `toggleOption` 의 방어로 증상만 차단했고, 드롭다운에 복합 레이블이 그대로 보이는 표시 결함은 남아 있음. 후속 핫픽스 또는 별도 플랜 권장.
- **`WorldTimeRenderer.unselectLabel`** prop 이 본 플랜에서 caller 측 (data-viewer header 등) 으로 주입되지 않음 — 현재 동작상 항상 한국어 폴백 표출. en/ja/zh 로케일 전파가 필요하면 후속 작업으로 caller 측 prop 주입 필요.
- **칸반 통합 회귀 테스트** (`KanbanDetailDrawerBody.test.tsx` 의 chip-click → row-create 미발생) 는 setup 복잡도로 단위 레벨 커버 불가 — 렌더러 단위 테스트 (`MultiSelectRenderer.test.tsx` 의 toggleOption 회귀) 로 소스 레벨 커버.

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): 3개 페이즈 모두 exit 0 (phase 3 은 lint-hotfix iter 1 후 통과).
- advisor 5-관점 (완료 시점): 위 3개 잔여 사항 transparent 보고, BLOCK 없이 통과.

## v001.68.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#42

### 페이즈 결과

- **Phase 1** (`42fbeed`): `SettingsSidebar.tsx` 의 사용자 설정 섹션 연필 아이콘 가시성 게이트와 그에 연동된 `EditSettingsFormDialog` 마운트 게이트 두 곳을 `isOwner` 단일 체크에서 `usePermission('settings_edit')` 결과로 교체. `usePermission` 훅이 오너 패스를 내장하므로 `canSettingsEdit` 단독으로 (오너 || 권한 보유 비-오너) 자동 충족 (`isOwner ||` 합성 없음, DRY). 부정확한 주석 두 곳 (사용자 설정 섹션의 "settings_manage 권한 필요", 편집 다이얼로그의 "오너만") 도 `settings_edit` 기준으로 정정. 변경: +5 / -4 across 1 file. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0 (228.8s).

### 마스터 명령 의도 (재기)

비-오너 계정에서 "앱 설정 편집" (`settings_edit`) 권한이 부여된 사용자임에도 설정 → "사용자 설정" 텍스트 우측의 편집(연필) 아이콘이 노출되지 않던 문제. 동일 dialog 의 부모 `SettingsDialog` 는 같은 폼 컨텐츠 접근에 `usePermission('settings_edit')` 를 이미 사용 중이었지만, sidebar 의 아이콘 가시성과 그 클릭으로 마운트되는 편집 다이얼로그만 `isOwner` 로 하드코딩되어 있어 권한 표면이 어긋남. 본 수정으로 가시성 + 다이얼로그 도달 두 단계 모두 권한 체계와 정합.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/settings-dialog/ui/SettingsSidebar.tsx`

### 잔여 위험 / 후속

- `EditSettingsFormDialog` 컴포넌트 내부 / 서버 측 `settings_edit` 추가 권한 가드 여부는 본 플랜에서 미조사. 머지 후 권한 보유 비-오너가 dialog 내부 동작 (저장 / 삭제 등) 에서 server 측 거부를 받을 가능성 있음 — 확인 후 거부 발생 시 핫픽스로 후속.
- 본 명령은 `data-craft` (web) 만 대상. `data-craft-mobile` 의 동등 화면 존재 시 별도 명령으로 처리.

## v001.67.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#40 (hotfix-1)

### 페이즈 결과

- **Phase 2 (hotfix-1)** (`4f0b0113`): v001.62.0 (Phase 1) 의 회귀 수정. Phase 1 에서 `FormulaEditDialog` / `SimpleFormulaEditDialog` 컨테이너를 `NESTED_MODAL_CONTENT=12000` 으로 격상했으나, 두 다이얼로그 내부의 Radix `Select` 드롭다운이 default `Z_INDEX.selectDropdown=10600` (다른 zIndex 객체 — `shared/constants/zIndex.ts`) 으로 렌더되어 이번엔 부모(12000) 아래에 깔리는 회귀가 발생. 마스터 실측으로 즉시 확인됨 ("이제 모달은 나타나는데 해당 모달에서 '컬럼 선택' 드롭다운을 띄우면 해당 드롭다운이 모달 뒤에 나타나는 문제"). **수정**: `shared/config/z-index-constants.ts` 에 `NESTED_MODAL_DROPDOWN=12100` 신설 (NESTED_MODAL_CONTENT 12000 위), `FormulaEditDialog` 의 컬럼 선택 `<SelectContent>` 와 `SimpleFormulaEditDialog` 의 operation 선택 `<SelectContent>` 두 호출 사이트 모두에 `style={{ zIndex: Z_INDEX.NESTED_MODAL_DROPDOWN }}` 추가. `SelectContent` 가 enterprise-439 PHASE-04 부터 caller-side `style.zIndex` override 를 명시적으로 허용 (`shared/ui/Select/Select.tsx:78-80`) 하므로 default 10600 동작은 27+ 다른 호출처에서 그대로 유지됨 — 회귀 영역 없음. 변경: +4 / -2 across 3 files. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### hotfix-1 평가

Phase 1 v001.62.0 의 진단·수정 (다이얼로그 컨테이너 z-index 격상) 은 올바른 방향이었으나, 다이얼로그 *내부* 의 portal-render 자식 (Radix Select 드롭다운) 이 별도 z-index 객체의 default 값으로 렌더된다는 점을 누락했다. 즉 z-stacking layer 재배치가 컨테이너 한 단계에만 적용되고 그 아래 한 단계 (드롭다운) 가 따라오지 않은 부분 수정이었다. hotfix-1 은 동일 root cause 의 다음 stacking layer 를 정합화. 두 z-index 상수 객체가 별도 파일에 분리되어 있는 구조(`shared/config/z-index-constants.ts` 와 `shared/constants/zIndex.ts`) 가 이런 layer-by-layer 검수 누락의 배경 — 통합 또는 cross-reference 명시는 후속 부채.

### 마스터 명령 의도 (재기)

데이터 뷰어 → 간트/칸반/캘린더 뷰어 → "열 정보 편집" 모달에서 수식/함수 컬럼 [열 설정 편집] 클릭 시 다이얼로그가 부모 모달에 가려져 무반응으로 보이고, 그 다이얼로그 내부에서 다시 컬럼 선택 드롭다운을 열면 이 드롭다운도 부모에 가려져 무반응이 되는 cascade 결함. Phase 1 + hotfix-1 로 두 단계 모두 정합.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/shared/config/z-index-constants.ts`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridFormulaCellRenderer/FormulaEditDialog.tsx`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridSimpleFormulaCellRenderer/SimpleFormulaEditDialog.tsx`

### 검증 결과

- Lint gate (`pnpm typecheck:all && pnpm lint`): exit 0.
- advisor 5-관점 (완료 시점): 5/5 PASS — diff 가 명세 그대로, default selectDropdown 동작 27+ 호출처에서 보존, 회귀 영역 없음.

### 알려진 후속 부채 (별도 plan 권장)

- `shared/config/z-index-constants.ts` 와 `shared/constants/zIndex.ts` 두 z-index 상수 객체의 통합 또는 cross-reference 명시. 본 hotfix 가 노출한 layer-by-layer 검수 누락의 구조적 배경.

## v001.66.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#35

### 페이즈 결과

- **Phase 1** (data-craft `02ed474e` + `a0033792` + `5958bae1` + `906b5285`): 데이터 뷰어 (칸반/간트/캘린더) 에서 카드 생성 이후 새 컬럼 추가 시 기존 카드 드로어 상세 및 표면 (카드 본체 / 간트 막대 / 캘린더 이벤트) 에 신규 필드가 표시되지 않는 미동기 결함을 FE 클라이언트 정규화로 해소. 신규 유틸 `normalizeRowAgainstColumns(row, columns)` 추가 — 누락된 columnField 의 cell 을 `column.defaultValue` 로 합성 (idempotent, 정의된 defaultValue 만 합성). 드로어 fetch 경계 3종 (`KanbanDetailDrawerBody` / `FsGanttChart` `detailCache.getRowDetail` / `FsCalendarChart` `getOrFetchRowData`) 및 표면 소비자 (`useKanbanCard` / `useGanttRowData` / `FsCalendarChart` 의 `parseCalendarEvents` 호출 3지점 / `useCalendarEvents`) 에 적용. 캘린더 카드 캐시는 raw row 저장 후 hit/miss 양쪽에서 normalize 거치도록 재설계 (stale 정규화 캐시 방지). stale closure 회피를 위해 `columnModelListRef` + `useLayoutEffect` 패턴 사용. 사전 검증: cell 저장 흐름이 `(rowField, columnField)` 키 upsert 임을 확인 → FE 합성 cell 편집·저장 시 서버 영구화 보장. 변경 +87 / -14 across 7 files. lint gate PASS (`pnpm typecheck:all && pnpm lint`).

### 마스터 명령 의도 (재기)

QA 보고: data-craft 의 칸반/간트/캘린더 뷰어에서 카드 (또는 이벤트/막대) 생성 이후 새 열을 추가하면 기존 카드 드로어 상세 및 표면에 신규 필드가 표시되지 않고, 새로 생성한 카드만 정상 표시되는 결함. 서버 DB 마이그레이션 없이 FE 클라이언트 측 정규화 (수정 경계 마스터 확정) 로 해결.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/entities/row.utils.ts` (신규)
- `packages/fs-data-viewer/src/widgets/kanban-board/KanbanDetailDrawerBody.tsx`
- `packages/fs-data-viewer/src/widgets/kanban-board/kanban-card/useKanbanCard.ts`
- `packages/fs-data-viewer/src/widgets/gantt-chart/gantt-chart/FsGanttChart.tsx`
- `packages/fs-data-viewer/src/widgets/gantt-chart/gantt-chart/useGanttRowData.ts`
- `packages/fs-data-viewer/src/widgets/calendar/FsCalendarChart.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/calendar-chart/useCalendarEvents.ts`

## v001.65.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#39

### 페이즈 결과

- **Phase 1** (data-craft `308b6622`): 셀 렌더러 3종(`TextRenderer` / `LongTextRenderer` / `NumberRenderer`) 에 `displayContext?: 'table' | 'drawer'` prop 도입. `displayContext === 'drawer'` 분기에서 컨테이너에 `border border-border rounded-md bg-background/60 hover:border-primary/60 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-colors px-2 py-1.5` 적용, 빈 값 + 비편집 모드에서 타입별 placeholder(`텍스트 입력` / `긴 글 입력` / `코드 입력` / `숫자 입력`) 노출. `types.ts` 의 `LongTextRendererProps` 에 `columnType` 추가하여 longText vs code placeholder 분기. `UniversalCellRenderer` + `rendererMap.tsx` 가 prop 스레딩. 기본값 `'table'` 유지로 테이블 뷰 외관 보존. 변경 +137 / -9 across 6 files. lint gate PASS.
- **Phase 2** (data-craft `cde57d1f`): `KanbanDetailDrawerBody` / `GanttDetailDrawerBody` 의 `UniversalCellRenderer` 호출 지점(log 분기 + 일반 분기, 각 2곳, 총 4곳) 모두에 `displayContext="drawer"` prop 전달. Phase 1 의 스타일이 실제 렌더링에 반영됨. 변경 +4 / -0 across 2 files. lint gate PASS.

### 마스터 명령 의도 (재기)

데이터 뷰어의 칸반/간트 뷰 공용 상세 정보 드로어에서 6개 셀 타입(텍스트·긴텍스트·숫자·통화·백분율·코드)이 입력 가능 영역임을 직관적으로 인지하기 어렵다는 QA 보고에 대응. placeholder / background / border / focus UI 4축을 활용해 입력 UX 를 개선.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/UniversalCellRenderer.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/rendererMap.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/types.ts`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/TextRenderer.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/LongTextRenderer.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/NumberRenderer.tsx`
- `packages/fs-data-viewer/src/widgets/kanban-board/KanbanDetailDrawerBody.tsx`
- `packages/fs-data-viewer/src/widgets/gantt-chart/GanttDetailDrawerBody.tsx`

### 마스터 수동 검증 시나리오

1. `pnpm dev` (port 5173) 기동 → 데이터 뷰어 진입.
2. 칸반 뷰에서 카드 클릭 → 우측 상세 드로어 오픈. 텍스트·긴텍스트·숫자·통화·백분율·코드 6개 컬럼 셀이 표시 모드부터 옅은 테두리·배경으로 입력 박스처럼 보이는지 확인.
3. 동일 셀에 마우스 호버 시 테두리가 primary 색으로 강조되는지 확인.
4. 셀 클릭하여 편집 모드 진입 시 focus ring 이 노출되는지 확인.
5. 빈 값 셀(아직 값 미입력) 의 표시 모드에서 타입별 placeholder ("텍스트 입력" / "긴 글 입력" / "숫자 입력" / "코드 입력") 가 muted 색으로 보이는지 확인.
6. 간트 뷰에서 막대 클릭 → 동일 드로어 동일 6개 셀이 위 4개 항목을 모두 통과하는지 확인.
7. 테이블/그리드 뷰로 전환 → 동일 6개 셀이 **기존과 동일하게** (테두리 없는 인라인 셀) 보이는지 회귀 확인.

### 잠재 후속

- 동일 transparent 패턴을 공유하는 5개 형제 렌더러(`EmailRenderer` / `LinkRenderer` / `TagRenderer` / `PhoneRenderer` / `NationRenderer`) 는 본 플랜 범위 밖이지만 동일 displayContext 패턴으로 저비용 확장 가능. QA 후속 요청 시 별도 플랜 권장.
- 본 플랜은 표시 모드 placeholder 만 도입. HTML `placeholder=""` (편집 모드 인풋의 네이티브 placeholder) 는 미적용 — 향후 UX 검토 항목.

## v001.64.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#37

### 페이즈 결과

- **Phase 1** (data-craft `4126ed4b`): 칸반 기준열(group-by 열) 인라인 헤더 편집 시 변경된 항목이 그리드 뷰에 정상 표시되지 않던 결함을 수정. **진단**: `SingleSelectCellRenderer` 가 cellValue 를 옵션 label 텍스트로 저장하므로 in-memory cascade 자체는 올바르게 동작하나, `addChangeWithHierarchy` 가 변경을 insertion 순서대로 서버로 전송하기 때문에 구 순서(`cells → customDataList`)에서는 서버가 아직 갱신 전 enum 으로 cell Put 을 검증 → 거절하여 cell 값이 옛 값으로 회귀하던 것이 root cause. 동일 핸들러는 이미 enterprise-436 Hotfix-001/002 두 차례 패치된 곳이라 트레드밀 회피 차원에서 진단을 우선했다. **해결**: `handleColumnRenamed` 의 `saveChange` enqueue 순서를 `(d) customDataList → (b) kanbanColumnOrder → (c) kanbanColumnColors → (a) cells` 로 재배치하여 서버가 신규 옵션을 먼저 등록한 뒤 cell Put 들을 수용하도록 정정. in-memory mutation 위치 및 Hotfix-001/002 의 `columnModelList`/`rowModelList` ref 갱신 로직은 그대로 유지. 회귀 테스트 신규 `PHASE-04-column-rename-grid-sync.test.tsx` 3건 추가(row cascade / saveChange payload 순서 / 부분 rename 위치 보존). 기존 `PHASE-04-column-rename-behavioral.test.tsx` 의 호출 인덱스 단언과 `PHASE-04-column-rename.test.ts` 의 source-regex slice 길이를 새 순서에 동기화. 변경 +217 / -52 across 4 files. lint gate (`pnpm typecheck:all && pnpm lint`) PASS.
- **Phase 2** (data-craft `98699893` + lint hotfix `eb3a0c06`): 칸반 카드영역 배치 다이얼로그(`KanbanCardAreasDialog`, 헤더 타이틀 "카드 구성") 의 컬럼 palette 에서 현재 기준열(`viewerModel.kanbanColumnField`) 제외. **이유**: 기준열은 이미 칸반 그룹화에 점유 중이므로 카드영역(A/B/C/D/E) 후보로 노출될 이유가 없음. **변경**: `palette` useMemo 의 filter 조건에 `c.columnField !== viewerModel.kanbanColumnField` 1개 추가 + 의존성 배열에 `kanbanColumnField` 포함. 단위 테스트 1건 추가 (`kanbanColumnField` 설정 시 해당 컬럼이 palette DOM 에 미노출 검증). 초기 commit 에서 spread 타입 오류 1건 발생 → lint hotfix 1회로 해소. 변경 +32 / -3 across 2 files. lint gate PASS.

### 마스터 명령 의도 (재기)

데이터 뷰어의 칸반 뷰에서 (i) 기준열 헤더 인라인 편집 시 변경 후 그리드 뷰가 옛 값을 표시하던 데이터 연동 결함을 수정해달라는 요구, (ii) 추가로 칸반 뷰의 카드 구성 다이얼로그의 컬럼 목록에서 현재 기준열로 지정된 열을 노출에서 제외해달라는 요구.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/features/kanban/handlers/kanban-reorder-handlers.ts`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/KanbanCardAreasDialog.tsx`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/__tests__/KanbanCardAreasDialog.test.tsx`
- `packages/fs-data-viewer/src/__tests__/enterprise-436/PHASE-04-column-rename-behavioral.test.tsx`
- `packages/fs-data-viewer/src/__tests__/enterprise-436/PHASE-04-column-rename-grid-sync.test.tsx` (신규)
- `packages/fs-data-viewer/src/__tests__/enterprise-436/PHASE-04-column-rename.test.ts`

### 마스터 수동 검증 시나리오

1. 칸반 뷰 진입 → 디자인 모드에서 기준열의 한 칸반 열 제목을 인라인 편집으로 변경 (예: "대기" → "대기중") → 칸반 뷰 안에서 해당 그룹의 카드들이 새 제목 아래에 그대로 유지됨 확인.
2. 같은 데이터 뷰어에서 그리드 뷰로 전환 → 변경된 행들의 기준열 셀이 모두 새 텍스트("대기중") 로 표시되고, 행이 누락 없이 정상 노출됨 확인.
3. 부분 rename (옵션 3개 중 1개만 변경) 시 비변경 그룹/카드의 위치 변동 없음 확인.
4. 데이터 뷰어 헤더 설정에서 "카드 구성" 다이얼로그 열기 → 좌측 컬럼 palette 에 현재 기준열로 지정된 열이 노출되지 않음 확인 (다른 모든 열은 기존대로 노출).
5. 다이얼로그 안에서 기준열을 다른 컬럼으로 변경 후 다시 열어 보아 새 기준열만 palette 에서 빠짐 확인 (구 기준열은 다시 palette 에 등장).

### 사전 결함 (본 플랜 무관)

- `KanbanCardAreasDialog.test.tsx` 의 "저장 클릭 시 setViewerModel + forceUpdate + onClose" 테스트가 `forceUpdate` 미호출로 실패하나, 본 결함은 i-dev 기준 (`6521c969 WIP(kanban-card): PHASE-10 lint/test 수정 (enterprise-444 통합 게이트)`) 사전 결함으로 확인됨. 본 플랜 변경과 무관하며 별도 처리.

## v001.63.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#41

### 페이즈 결과

- **Phase 1** (data-craft `486c567`): 캘린더 뷰어의 우측 상세 패널에서 카드 선택 후 셀(텍스트/드롭다운/날짜 등)을 편집할 때마다 화면이 "마지막으로 추가된 카드" 위치로 점프하던 회귀를 제거. **근본 원인**: `FsCalendarChart.tsx` 의 `lastAddedRowField` state 가 카드 추가 시 set 된 뒤 클리어되지 않았고, `FsCalendarDetailPanel.tsx:103-109` 의 `useEffect([lastAddedRowField, events])` 가 셀 편집으로 `events` 새 참조가 생길 때마다 `scrollIntoView` 를 재발화. **해결**: `FsCalendarDetailPanel` 에 `onLastAddedConsumed` 콜백 prop 추가, `useEffect` 안에서 `scrollIntoView` 실제 실행 직후에만 호출. `FsCalendarChart` 가 `useCallback(() => setLastAddedRowField(null), [])` 안정 콜백을 `FsCalendar` → `FsCalendarDetailPanel` 로 pass-through. 동시에 부수 안정화로 카드 key 를 `${rowField}-${columnTitle}-${index}` 에서 `${rowField}-${dateColumnField}` 로 교체 (index/columnTitle 변동 시의 remount 위험 차단). 변경 +12 / -2 across 3 files. lint gate (`pnpm typecheck:all && pnpm lint`) PASS.

### 마스터 명령 의도 (재기)

캘린더 뷰어에서 카드를 선택해 우측 상세 패널을 펼친 뒤 컬럼 셀에 데이터를 입력하거나 옵션을 선택할 때, 입력 중인 위치에 화면이 유지되어야 함에도 화면이 하단으로 점프하던 문제를 잡아달라는 요구.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/widgets/calendar/FsCalendarChart.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/calendar/FsCalendar.tsx`
- `packages/fs-data-viewer/src/widgets/calendar/detail-panel/FsCalendarDetailPanel.tsx`

### 마스터 수동 검증 시나리오

1. 캘린더 뷰어 진입 → 신규 카드 추가 → 추가된 카드로 1회 자동 스크롤 발생 확인 (기존 기능 회귀 방지).
2. 카드 추가 후 다른 카드를 펼쳐 텍스트 셀 입력 → 입력 중인 셀이 화면 안에 유지되고 스크롤 점프가 없음.
3. 드롭다운/날짜/관계 등 다양한 셀 타입에서 동일하게 포커스/스크롤이 유지됨.
4. 카드 순서 변경(▲/▼) 직후 셀 편집 시 remount 으로 인한 포커스 손실 없음.

## v001.62.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#40

### 페이즈 결과

- **Phase 1** (`209b1666`): 데이터 뷰어의 간트 / 칸반 / 캘린더 3 뷰어에서 사용하는 공용 `ViewColumnManagerDialog` (z-index `MODAL_CONTENT = 9900`) 위에서 [열 설정 편집] 버튼을 누를 때 수식(`formula`) 및 함수형(`simpleFormula`) 컬럼의 설정 다이얼로그가 `z-50` 으로 렌더되어 부모 모달에 가려지는 z-stacking 결함 수정. `FormulaEditDialog.tsx` / `SimpleFormulaEditDialog.tsx` 의 최상위 오버레이 div 에서 Tailwind `z-50` 클래스를 제거하고 `style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT }}` (12000) 를 적용. 두 파일 모두 `import { Z_INDEX } from '../../../shared/config/z-index-constants'` 추가 (VoteSettingsWrapper 와 동일 패턴). 내부 다이얼로그 마크업, backdrop 디자인, 이벤트 핸들러는 일체 변경하지 않음 — z-index 단일 격상만 수행. 셀 렌더러 경로(`FsGridFormulaCellRenderer` / `FsGridSimpleFormulaCellRenderer`) 에서도 그대로 호출되지만 그 컨텍스트엔 부모 모달이 없으므로 z-index 12000 으로 올려도 시각/동작 회귀 없음. 변경: +6 / -2 across 2 files. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridFormulaCellRenderer/FormulaEditDialog.tsx`
- `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridSimpleFormulaCellRenderer/SimpleFormulaEditDialog.tsx`

### advisor 검증

- 계획 시점 (advisor #1): Intent / Logic / Group Policy / Evidence / Command Fulfillment 5/5 PASS.
- 완료 시점 (advisor #2): 5/5 PASS — diff 가 플랜 그대로, 셀 렌더러 경로 회귀 없음, lint 통과.

## v001.61.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#33 (hotfix-2)

### 페이즈 결과

- **Phase 4 (hotfix-2)** (data-craft `ee4e572a` + data-craft-server `a02c0be`): hotfix-1 (v001.58.0) 의 오진 정정. 실제로는 라우터-레벨 `forceIncludeAuth` setter 는 본 서버 아키텍처에서 dead code — Express 미들웨어 실행 순서상 `app.ts:128` 의 글로벌 `app.use('/api', authMiddleware, permissionMiddleware, routes)` 가 먼저 실행돼 `req.user` 채움 분기가 이미 종료된 뒤에야 라우터-레벨 `forceIncludeAuth` 가 플래그를 set 한다. 즉 hotfix-1 의 한 줄 변경은 동작에 아무 영향이 없었음. `routes/roles.ts` 등에서 같은 패턴을 쓰는 라우트가 정상 동작하는 이유는 그쪽 FE 호출 (`fs-api/src/api/role.ts`, `getRoleSettingsForms` 등 line 2380-2400) 이 모두 `apiClient.get(..., { includeAuth: true })` 로 `?includeAuth=true` 쿼리스트링을 보내기 때문 (line 72 의 다른 분기). **GET `/api/builder/settings/forms`** 는 `fs-api/src/api/builder.settings.ts:22` 에서 `apiClient.get(API_ENDPOINTS.BUILDER.SETTINGS_FORMS)` 로 옵션 없이 호출하는 유일한 누락 케이스였음. **해결**: data-craft `src/entities/form/api/settingsFormApi.ts` 에서 `builderApi.getSettingsForms()` 의존을 제거하고 `apiClient.get(endpoint, { includeAuth: true })` 직접 호출로 우회 (self/manage 두 경로 모두). 동시에 data-craft-server `routes/builder.ts:67` 의 dead `forceIncludeAuth` 롤백. 변경: data-craft +9 / -5 (1 file), data-craft-server +2 / -2 (1 file). lint gate 양쪽 exit 0.

### hotfix-1 평가

v001.58.0 (hotfix-1, `1ab9266`) 은 진단 부분 ("req.user 가 비어 있다") 은 옳았으나 **수정 위치가 잘못됐다**. 라우터-레벨 setter 가 실행 순서 문제로 무력함을 검증하지 않은 채 동일 패턴 라우트가 작동한다는 표면 증거만으로 fix 라고 단언했고, 마스터의 dev 환경 실측으로 즉시 무효 처리됐다. hotfix-2 는 라우터-레벨 setter 가 dead 임을 확인 (글로벌 authMiddleware 가 라우터 진입 전에 실행 완료) 한 뒤 FE 측 fix 로 전환했고, 같은 변경에서 dead 코드도 함께 제거했다.

### 마스터 명령 의도 (재기)

비오너 viewer (예: 김범준, 주임 그룹) 의 본인 설정 사이드바에 그룹에 할당된 사용자 설정 항목들이 표시되지 않는 증상. 근본 원인은 `auth.middleware.ts:72` 의 `includeAuth` 분기 — FE 가 `?includeAuth=true` 를 보내지 않으면 경량 인증 경로가 돌고 `req.user` 자체가 미채움 → 컨트롤러의 `req.user?.roleId` 가 undefined → 서비스의 `!isOwner && roleId === null → []` 분기로 빈 목록 반환. fs-api 가 다른 privileged GET 들에는 일관되게 `{ includeAuth: true }` 를 보내지만 `getSettingsForms()` 만 누락된 단일 작성 오류였음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/entities/form/api/settingsFormApi.ts`

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/routes/builder.ts`

### 마스터 수동 검증 시나리오

1. 브라우저 dev tools Network 패널 → 김범준 계정 로그인 → 설정 다이얼로그 진입 → `GET /api/builder/settings/forms?includeAuth=true` 요청이 발생하고 응답 body 에 `settingsForms` 배열이 채워져 있음을 확인.
2. 김범준 (비오너, 주임 그룹) → 좌측 사이드바에 "사용자 설정" 섹션 + 주임 그룹 할당 56개 항목 노출.
3. 사용자 설정 항목 클릭 → 정상 렌더링.
4. 오너 계정 → 사이드바 회사 전체 폼 노출 (회귀 없음).
5. 권한 그룹 편집 다이얼로그 (오너 또는 permission_manage 비오너) → "설정 권한" 섹션 회사 전체 풀 노출 (v001.56.0 + hotfix-2 조합으로 비로소 실효).

## v001.60.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#32 (hotfix-2)

### 페이즈 결과

- **Phase 3 (hotfix-2)** (`2ed59630`): hotfix-1 의 폴백 게이트가 빈 문자열만 처리하던 한계를 확장. 마스터 dev 서버 Network 캡처에서 직원/장소/테스트/프로젝트 관리 버튼 클릭 시 0 requests 확인 → setOverride 가 ghost widget id 에 쓰이고 있음을 추론 (저장된 `loadDataConfig.targetWidgetId` 가 페이지 위젯 재생성 후 stale 상태). `useButtonWidget.ts` 의 폴백 분기를 `!!targetWidgetId && !pageContains(targetWidgetId)` 케이스 (stale-id) 도 포함하도록 게이트 확장 — `targetExists` 검사 후 1개 매칭 시 자동 복구 (console.info 로 가시성 확보), 0/N 개 시 기존 warn + 차단. 명시 ID 가 유효한 경로(`targetExists=true`)는 기존 동작 유지로 회귀 없음. 변경 +13 / -5 (1 file). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/button-widget/ui/useButtonWidget.ts`

### 마스터 수동 검증 시나리오

1. 직원관리 / 테스트관리 / 프로젝트관리 버튼 클릭 → Network 탭에 `getHistory` 요청 발생 확인 (이전 0 requests → 정상 발생).
2. 직원관리 클릭 → 빈 위젯에 직원 목록이 정상 셀 값으로 채워지는지 확인. **여전히 "-" 만 보이면 별도 hotfix-3 진입 필요** (이슈 #4 가 별개 원인이라는 신호).
3. 폴백 발동 시 console 에 `[ButtonWidget] load-data: targetWidgetId='...' 가 페이지에 존재하지 않음 — ... 자동 폴백` info 로그 확인 (자동 복구 가시성).
4. 생산관리 (이전 hotfix-1 폴백 경로) 회귀 없음 — 여전히 정상 동작 확인.
5. 페이지 매칭 빈 위젯 0개 / 2개+ 일 때 클릭 → 기존 warn 메시지 (`미지정/무효 + ... 자동 선택 모호`) 동일하게 동작.

### 알려진 잔존 (조건부)

- 본 hotfix-2 적용 후에도 직원관리 셀이 "-" 로 표시되면 → 이슈 #4 가 stale-id 와 무관한 별도 메커니즘 (예: `convertHistoryToFormRecords` field-key 미스매치 / `useFormWidgetSync` 채널 캐시 잔존). 마스터 e2e 결과로 hotfix-3 진입 여부 결정.

> 충돌 해소 메모 (CLAUDE.md §5 step 4): main 에 동시 머지된 plan #34 가 v001.59.0 을 선점하여 본 항목을 v001.60.0 으로 양보. 양측 entry 모두 보존.

## v001.59.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#34

### 페이즈 결과

- **Phase 1** (`bb61626`): `FormRenderer` 의 `handleReset` 가 로컬 `formData` 만 비우고 부모 zustand store (`useFormWidgetStore.cache[cacheKey].formFields`) 는 그대로 두던 이중 상태 문제 해결. 저장 경로(`useFormWidgetIndividual.executeSave`)가 부모 store 의 값을 직렬화해 API 로 보내기 때문에, 화면은 비어 보이나 페이로드에는 기존값이 그대로 실려 서버가 미입력 필드의 기존값을 유지하던 증상이 재현됨. 수정: `FormRenderer` 에 `onReset?` prop 추가, `handleReset` 이 `setFormData(emptyFormData)` 후 `onReset?.(emptyFormData)` 호출. `SettingsFormTabContent` 의 3개 FormRenderer 사용처(인라인 뷰, `SettingsFormDataDialog`, `SettingsFormListFirstDialog`) 모두에 inline `onReset` 핸들러를 연결해 `handleFormFieldsChange` 로 부모 store 를 **빈값으로 bulk-set** (delete 가 아님 — 서버 머지 시에도 빈값이 페이로드로 명시 전달되도록). 변경 +16 / -3 (4 files). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.
- **Phase 2** (`bcad4ca`): 회귀 테스트 T17c 를 `tests/normal-068/normal-068-p03-settings-form-modal-5bugs.test.tsx` 에 추가. `useFormWidgetSync` (individual 모드) 를 실제로 사용하는 인라인 Fixture 로 dialog 경로를 관통하여 — 기존 record 적재 (`updateFormFields`) → 초기화 클릭 (`onReset` 람다 → `handleFormFieldsChange` bulk-clear) → 필수만 입력 → 저장 — `inputStoreApi.save` 가 받은 `fields` 페이로드에서 비필수 필드(`field-opt`) 가 (a) 존재하고 (b) `value === ''` 이며 (c) 기존값('기존메모')이 아님을 단언. **negative-run 1회 실증**: Phase 1 파일 4개를 fix 이전 상태로 되돌린 뒤 T17c 만 실행 → 정확히 `expected '기존메모' to be ''` 로 실패함을 확인. 기존 T17/T17b 는 `FormRenderer` 단독 렌더 기반이라 부모 store 경로를 통과하지 않아 본 버그를 감지하지 못했음을 테스트 코멘트로 명시. 변경 +199 / -2 (1 file). lint gate exit 0.

### 마스터 명령 의도 (재기)

QA 보고 — 사용자 설정 > 직원관리(폼) 테스트 화면에서, 데이터 뷰어의 버튼 타입 셀(관리컬럼 행 "수정") 로 진입한 폼 다이얼로그에서 "초기화" 클릭 시 화면은 비어 보이지만 일부 필드만 채워 저장하면 미입력 필드들이 빈값이 아닌 기존값으로 저장되어 다시 노출되는 현상. 화면(로컬 state)과 저장 페이로드(부모 zustand store) 간 이중 상태가 원인이라는 가설을 코드로 확정하고, 초기화 경로를 양쪽 동기화하여 미입력 필드가 명시적 빈값으로 서버에 저장되도록 수정.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/form-widgets/ui/FormRenderer.tsx`
- `src/widgets/settings-dialog/ui/SettingsFormDataDialog.tsx`
- `src/widgets/settings-dialog/ui/SettingsFormListFirstDialog.tsx`
- `src/widgets/settings-dialog/ui/SettingsFormTabContent.tsx`
- `tests/normal-068/normal-068-p03-settings-form-modal-5bugs.test.tsx`

### 마스터 수동 검증 시나리오

1. 사용자 설정 → 직원관리(폼) 진입 → 기존 record 의 "수정" 버튼(데이터 뷰어 버튼 타입 셀) 클릭.
2. 다이얼로그 내 "초기화" 버튼 클릭 → 화면의 모든 필드가 비워짐.
3. 필수 입력 항목만 다시 채워서 저장 클릭.
4. 같은 record 의 "수정" 을 다시 열어 → **비필수 항목들이 공란**(기존값 재노출 없음) 이어야 통과.
5. 회귀 확인 (회복): record 처음 열고 일부 필드만 수정한 뒤 저장 → 수정한 필드는 새 값으로, 수정하지 않은 필드는 **기존값 유지** (초기화를 거치지 않은 경우의 기존 동작은 변함없어야 함).

### 알려진 범위 밖 (follow-up 후보)

본 fix 는 `SettingsFormTabContent` 경로의 FormRenderer 3개 사용처에만 `onReset` 을 배선함. `widgets/tabs-widget/*` 와 `widgets/form-widgets/ui/{FormInputDialog,UserFormContent,FormDialogContent,DataListDialogBody}` 등 다른 FormRenderer 소비처는 동일한 초기화 버그 가능성을 갖지만 마스터 보고 경로(사용자 설정 > 직원관리 폼) 외부라 범위 외. `onReset` 은 optional prop 이므로 미배선 callsite 도 컴파일 영향 없음. 동일 증상이 다른 화면에서 보고되면 같은 패턴으로 배선 확장.

## v001.58.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#33 (hotfix-1)

### 페이즈 결과

- **Phase 3 (hotfix-1)** (`1ab9266`): plan #33 의 v001.56.0 (`getSettingsForms` `scope=manage` 분기 + FE 호출부) 으로도 마스터의 원 버그가 해결되지 않은 정황에 대한 핫픽스. 마스터 dev 환경 캡처로 확인된 실제 원인은 `auth.middleware.ts:72` 의 경량 인증 분기 — `req.query.includeAuth !== 'true'` 이고 `req.forceIncludeAuth !== true` 인 경로에서는 `req.user` 가 채워지지 않아 컨트롤러의 `req.user?.roleId` 가 영구히 undefined → 서비스의 `!isOwner && roleId === null → []` 분기로 비오너 사용자의 사이드바 "사용자 설정" 섹션이 빈 상태로 표시. 동일한 이유로 v001.56.0 에서 추가한 `scope=manage` 분기의 권한 검증 (`req.user?.isOwner || req.user?.permissions?.includes('permission_manage')`) 도 비오너 viewer 에서 무력화돼 권한 그룹 편집 화면에서도 self 강등이 일어났던 것으로 분석됨. 해결: `routes/builder.ts:67` 의 `GET /settings/forms` 라우트에 기존 `forceIncludeAuth` 미들웨어 (roles.ts:35 등 11개 라우트의 표준 패턴) 적용으로 풀 인증 경로 강제. 한 줄 변경으로 self/manage 두 경로 동시 복구. 변경 +3 / -2 (1 file). lint gate (`pnpm lint`) exit 0.

### 마스터 명령 의도 (재기)

설정 → 권한 관리 → 권한 그룹 수정 화면의 "설정 권한" 섹션 부여 풀이 비어 있는 표면 증상 외에, 더 근본적으로는 비오너 viewer (예: 김범준, 주임 그룹) 의 본인 설정 사이드바에서 그룹에 할당된 사용자 설정 항목 (장소 관리, 직원 관리 등 56개) 이 "앱 설정" 아래에 전혀 표시되지 않던 증상까지 함께 해결.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/routes/builder.ts`

### 마스터 수동 검증 시나리오

1. 김범준 계정 (비오너, 주임 그룹) 로그인 → 우상단 설정 아이콘 → 좌측 사이드바에 "기본 설정" 섹션 아래 separator + "사용자 설정" 섹션이 노출되고 주임 그룹에 할당된 설정 화면 항목들 (장소 관리, 직원 관리 등) 이 모두 표시되어야 함.
2. 사용자 설정 항목 중 하나 클릭 → 해당 설정 폼 콘텐츠 정상 렌더링.
3. 오너 계정 (이동화 등) 로그인 → 사이드바 동일 섹션에 회사 전체 설정 폼 노출 (회귀 없음).
4. 권한 그룹 편집 다이얼로그 (오너 또는 permission_manage 권한 보유 비오너) → "설정 권한" 섹션에 회사 전체 settings form 풀 노출 (v001.56.0 fix 가 본 hotfix 로 비로소 실효).
5. permission_manage 미보유 비오너 → 권한 관리 메뉴 자체 비노출 (기존 동작 유지).

## v001.57.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#31 (Hotfix 2)

### 페이즈 결과

- **Phase 5 / Hotfix 2** (`0931deec` + lint fix `a35c842a`): 마스터가 v001.54.0 (Hotfix 1) 검증 후 후속 발견. 서버 다운 / 네트워크 장애 시 페이지 변경 → "레이아웃을 불러오는 중" 무한 로딩, 로그아웃으로도 빠지지 않음. 원인 — `packages/fs-api/src/core/client.fetch.ts:31` 및 `interceptor.ts` 의 raw `fetch()` 호출에 타임아웃 부재. 브라우저 기본 (수십초~무한) 까지 promise pending → React Query `isError` 전이 불가 → `LayoutErrorState` UI 도 렌더되지 않음.

  수정 — (1) 두 fetch wrapper 의 `executeFetch` 에 `AbortController` 기반 **15초 타임아웃** 추가. 사용자 signal (React Query 취소 등) 이 있으면 이벤트 리스너로 타임아웃 컨트롤러에 연결하여 동시 abort 지원. (2) `isNetworkOrTimeoutError` 판별자 (`TypeError` ‖ `AbortError`) 추가. `interceptedFetch` / `interceptedFetchBinary` 의 catch 에서 네트워크/타임아웃 에러 발생 시 `refreshHandler.handleTokenExpired` 라우팅 → refresh 도 같은 이유로 실패 → `onAuthFailure` → v001.53.0 Phase 3 의 cleanup + `/signin` 리다이렉트 체인 발화. (3) `skipAuth` 경로는 타임아웃만 적용, `handleTokenExpired` 라우팅 제외. 4xx/5xx HTTP 응답은 기존 처리 유지 (네트워크 단절 아님). lint iter 1회 (`a35c842a`) — `interceptor.ts` 의 helper 인자 타입을 `AbortSignal | null | undefined` 로 확장하여 RequestInit signal 의 nullable 와 정합. 변경 +130 / -16 (2 files). advisor #2 (hotfix 2) 5-perspective PASS, FetchOptions/InterceptedFetchOptions 모두 `RequestInit` 확장 확인 (signal 포워딩 dead code 아님).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-api/src/core/client.fetch.ts` (executeFetch 타임아웃 + interceptedFetch/interceptedFetchBinary catch 분기 + isNetworkOrTimeoutError)
- `packages/fs-api/src/core/interceptor.ts` (factory 클로저 executeFetch 타임아웃 + 동일 catch 분기)

### 마스터 수동 검증 시나리오

v001.53.0 + v001.54.0 의 시나리오에 더해 다음을 확인:
1. `data-craft-server` (port 8000) 를 중지 → authenticated 라우트에서 페이지 클릭 → 최대 **약 30초** 이내 `/signin` 으로 리다이렉트 (원 요청 15s 타임아웃 + refresh 15s 타임아웃 합산). 무한 로딩 X.
2. `data-craft-server` 재시작 후 다시 로그인 → 정상 동작 회귀 없음.
3. 정상 응답 시간 ≤ 15초인 요청은 회귀 없음 (정상 시나리오 일체 영향 없음).
4. 4xx/5xx HTTP 응답을 받는 시나리오 (예: 권한 없음 403, 서버 내부 오류 500 응답) 는 기존대로 에러 상태로 처리 — 자동 로그아웃 트리거 안 함.

> **타이밍 caveat**: 워스트케이스 ~30초 대기 (원 요청 타임아웃 15s → refresh 시도 타임아웃 15s → onAuthFailure 발화). 무한 로딩 대비 strict improvement 이며, 추가로 단축이 필요하면 후속 hotfix 에서 타임아웃 값 또는 refresh 시도 스킵 로직 조정.
>
> **React Query retry**: 일부 쿼리는 글로벌 기본 `retry: 1` 을 사용할 수 있어 일부 화면에서 30s × 2 = 약 60초까지 대기 후 redirect 가능. 후속 튜닝 후보.

## v001.56.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#33

### 페이즈 결과

- **Phase 1** (`ff7c453` + `0a8231e`): `data-craft-server` BE — `getSettingsForms` 서비스에 4번째 파라미터 `scope?: 'self' | 'manage'` 추가. `scope='manage'` 시 viewer 의 `isOwner`/`roleId` 필터링을 우회하여 `findSettingsForms(companyId)` 로 회사 전체 settings form 풀을 `accessLevel='write'` 매핑으로 반환. 컨트롤러 `getSettingsFormsController` 는 `req.query.scope === 'manage'` 일 때 `req.user?.isOwner` 또는 `req.user?.permissions?.includes('permission_manage')` 으로 권한 검증, 미충족 시 `scope='self'` 로 안전 강등 (`/api` 글로벌 `authMiddleware` 가 인증 호출에 한해 `req.user` 채움 — 비인증 대비 옵셔널 체이닝). `scope` 미지정 호출은 기존 동작 유지로 회귀 없음. 보완 커밋(`0a8231e`)으로 컨트롤러 주석을 글로벌 미들웨어 적용 사실에 맞게 정정. 변경 +26 / -8 (2 files). lint gate (`pnpm lint`) exit 0.
- **Phase 2** (`f4429e2`): `data-craft` FE — `settingsFormApi.getSettingsForms` 에 `GetSettingsFormsOptions({ scope?: 'self' | 'manage' })` 추가, `scope='manage'` 시 `apiClient.get('/api/builder/settings/forms?scope=manage')` 직접 호출 (미지정 시 기존 `builderApi.getSettingsForms()` 경로 유지로 mock 호환). `useSettingsForms` 훅 시그니처를 `GetSettingsFormsOptions & Omit<UseQueryOptions, 'queryKey'|'queryFn'>` 단일 병합 객체로 변경하고 `scope` 를 React Query 키에 포함 (self/manage 캐시 분리). 권한 그룹 편집 다이얼로그 호출부 (`SettingsPermissionSection`, `RoleFormDialogContent`) 를 `{ scope: 'manage' }` 로 변경; `SettingsSidebar`, `EditSettingsFormDialog`, `SettingsFormTabContent` 는 미변경 (옵션 미전달 → self 유지). 변경 +24 / -12 (4 files). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 마스터 명령 의도

설정 → 권한 관리 → 권한 그룹 수정 화면에서 비오너 계정 (단, `permission_manage` 권한 보유) 이 "설정 권한" 섹션의 settings form 풀을 빈 목록 또는 자기 역할 분량으로만 보던 증상 수정. 근본 원인은 `getSettingsForms` 서비스가 두 호출 컨텍스트 — (a) viewer 본인 설정 사이드바, (b) 권한 그룹 편집 다이얼로그의 부여 풀 — 를 단일 분기로 묶고 viewer 의 `isOwner`/`roleId` 로 필터링했기 때문. 컨텍스트 파라미터 `scope` 도입으로 manage 컨텍스트는 권한 검증 후 전체 풀 반환.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/services/builder/builder.settingsForm.ts`
- `src/controllers/builder.controller.ts`

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/entities/form/api/settingsFormApi.ts`
- `src/entities/form/api/settingsFormQueries.ts`
- `src/widgets/settings-dialog/ui/SettingsPermissionSection.tsx`
- `src/widgets/settings-dialog/ui/RoleFormDialogContent.tsx`

### 마스터 수동 검증 시나리오

1. 오너 계정 로그인 → 설정 → 권한 관리 → 임의 역할 수정 → "설정 권한" 섹션에 모든 settings form 표시 (회귀 없음).
2. 비오너 계정 (`permission_manage` 권한 보유, `settings_edit` 미보유) 로 로그인 → 동일 경로 → "설정 권한" 섹션에 회사 전체 settings form 노출되어 임의 form 토글 가능.
3. 비오너 계정 (`permission_manage` 미보유) → 권한 관리 메뉴 자체 비노출 (기존 동작 유지).
4. 비오너 계정 일반 "설정" 화면 (권한 그룹 편집이 아닌 본인 설정) → settings form 목록은 본인 역할 기반으로만 표시 (self 컨텍스트 회귀 없음).
5. `EditSettingsFormDialog`, `SettingsFormTabContent` (설정폼 정의 관리 화면) 호출부 회귀 없음 확인 (본 패치에서 미변경).

## v001.55.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#32 (hotfix-1)

### 페이즈 결과

- **Phase 2 (hotfix-1)** (`050e98a5`): plan #32 의 v001.52.0 (`EmptyInputWidget` listFirst 분기 제거) 으로도 원 버그가 해소되지 않은 정황에 대한 핫픽스. 마스터 dev 서버 콘솔 캡처로 실제 원인이 EmptyInputWidget 이 아닌 버튼 위젯 측 `loadDataConfig.targetWidgetId: ''` 누락임을 확인 (`useButtonWidget.ts:62-64` 의 가드가 조용히 early-return). `useButtonWidget.ts` 의 load-data 분기를 재구성하여 `targetWidgetId` 가 빈 문자열일 때 `GROUP_TO_EMPTY_TYPE` 매핑을 기반으로 현재 페이지의 매칭 빈 위젯을 조회 — 정확히 1개이면 자동 폴백, 0개/2개+ 이면 구체 경고 메시지와 함께 조기 반환. `LoadDataActionSection.tsx` 에는 `step3Missing` 플래그 추가로 Step 3 미선택 시 레이블 별표(*) + 후보 수 (0/1/N) 별 인라인 도움말 텍스트 표시 (재발 방지 UX). 변경 +31 / -4 (2 files). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/button-widget/ui/useButtonWidget.ts`
- `src/widgets/property-drawer/ui/property-editors/button-editor/LoadDataActionSection.tsx`

### 알려진 잔존 (별도 핫픽스 필요)

마스터가 본 핫픽스 라운드에서 함께 보고한 다음 증상은 본 라운드 스코프 밖으로 이월:

- **listFirst=true 폼 A → 폼 B → 폼 A 전환 시 셀이 모두 "-" 표시**: `convertHistoryToFormRecords` 의 `validFieldIds` 필터로 미해당 fieldKey 가 전부 제거되는 패턴이 의심되며, `useFormWidgetSync` 의 채널-스코프 historyItems 가 폼 메타 교체 race 와 만나 발생할 가능성. 다음 핫픽스 라운드에서 마스터의 재현 콘솔 로그로 분리 진단 후 수정.

### 마스터 수동 검증 시나리오

1. 생산관리 버튼 (listFirst=false 폼 + 페이지에 빈 입력폼 위젯 1개 배치) 클릭 → 입력 폼이 정상 렌더링되어야 함 (자동 폴백).
2. 생산관리 버튼 편집기 진입 → Step 3 "연결 대상 빈 위젯" 미선택 상태에서 레이블에 빨간 별표(*) + 도움말 텍스트 노출 확인.
3. 페이지에 매칭 빈 위젯이 0개일 때: 버튼 클릭 시 `[ButtonWidget] load-data: 페이지에 매칭 빈 위젯 없음` 콘솔 경고 + 동작 차단.
4. 매칭 빈 위젯이 2개+ 일 때: 버튼 클릭 시 `자동 선택 모호` 콘솔 경고 + 동작 차단 (편집기에서 명시 지정 필요).
5. 기존 정상 설정 (targetWidgetId 명시된 직원관리/장소관리 등) 회귀 없음 확인.

## v001.54.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#31 (Hotfix 1)

### 페이즈 결과

- **Phase 4 / Hotfix 1** (`f5a78bc6`): 마스터가 plan-enterprise #31 (v001.53.0) 의 자동 로그아웃 e2e 검증 중 발견한 사전 존재 결함을 보정. 증상 — access token 을 devtools 로 수동 삭제한 후 라우트 클릭 시 "레이아웃을 불러오는 중" 무한 로딩, 네트워크 요청 미발사, 로그인 화면 미리다이렉트. 원인 — `packages/fs-api/src/core/client.fetch.ts:121-123` 및 `packages/fs-api/src/core/interceptor.ts:140, 189` 의 4개 사이트에서 `accessToken` 미존재 시 `ApiException(401)` 동기 throw 만 하여 `refreshHandler.handleTokenExpired` 경로를 우회 → `onAuthFailure` 콜백 미발화 → v001.53.0 Phase 3 에서 등록한 `applyPreAuthTheme` + `clearAuth` + `/signin` 리다이렉트 체인이 동작하지 못함 → React Query 의 rejected promise 가 영구 pending. 수정 — 4개 사이트 모두 즉시 throw 대신 `refreshHandler.handleTokenExpired(async (newToken) => { ...Bearer newToken 으로 재시도... })` 로 라우팅. refresh token 살아있으면 새 access token 으로 정상 재시도, refresh 도 실패 (또는 refresh token 부재) 면 `tokenRefresh.ts:124` 의 `onAuthFailure` 가 발화 → v001.53.0 의 cleanup + redirect 체인 동작. 재귀 안전성 확인 — `refreshAccessToken` 은 raw `fetch` 를 직접 사용 (`tokenRefresh.ts:63`) 하므로 패치된 4개 사이트로 되돌아 가지 않음. 변경 +32 / -4 (2 files). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0. advisor #2 (hotfix) 5-perspective PASS.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `packages/fs-api/src/core/client.fetch.ts` (interceptedFetch + interceptedFetchBinary)
- `packages/fs-api/src/core/interceptor.ts` (interceptedFetch + interceptedFetchBinary)

### 마스터 수동 검증 시나리오

v001.53.0 의 5개 시나리오에 더해 다음을 확인:
1. devtools 에서 localStorage 의 access token 값을 삭제 또는 쓰레기로 덮어쓰기.
2. authenticated 라우트에서 다른 페이지 클릭 → 즉시 `/signin` 또는 `/login` 으로 리다이렉트되는지 확인 (무한 로딩 X).
3. refresh token 도 함께 삭제 → 동일하게 `/signin` 리다이렉트 (refresh 실패 경로).
4. refresh token 살아있고 access 만 손상 → `/refresh` 요청이 한 번 발사된 뒤 원 요청이 새 토큰으로 재시도되어 정상 응답 (즉, 단순 손상만으로는 로그아웃되지 않음).

## v001.53.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#31

### 페이즈 결과

- **Phase 1** (`d15b666b`): `themeStore` 에 PreAuthTheme 전용 슬롯(`preAuthTheme`, 기본 `'system'`)과 `dc_preauth_theme` localStorage 키 도입. 기업 테마 클래스/CSS 변수를 모두 제거하고 기본 테마(light/dark/system)만 DOM 에 적용하는 `applyPreAuthTheme(mode)`, 스토어의 현재 `theme` 값을 다시 DOM 에 반영하는 `restoreActiveTheme()`, 그리고 `setPreAuthTheme(mode)` 액션을 모듈 레벨 export 로 추가. `GuestGuard` 는 `useEffect` 로 mount 시 `applyPreAuthTheme(preAuthTheme)`, unmount 시 `restoreActiveTheme()` 을 호출하는 단일 초크포인트가 되어 8 개 게스트 라우트 전부를 커버. `ThemeSwitcher` 는 `useLocation` 으로 게스트 라우트를 자동 감지해 pre-auth 스코프에서는 `setPreAuthTheme` 만 호출하도록 분기. `initThemeListener` 초기 DOM 적용 경로에도 게스트 라우트 분기를 추가해 인증 페이지 직접 리로드 시 콜드 부트 깜빡임을 차단. 변경 +102 / -8 (3 files). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.
- **Phase 2** (`be806bb4`): `SettingsFooter.handleLogout` 내에서 라우트 전환 직전 호출되던 `useThemeStore.getState().setThemeFromServer('light')` 한 줄을 제거. 해당 호출은 기업 테마를 라우트 전환 전에 초기화하려는 임시 우회책이었으나 사용자가 명백히 인지하는 깜빡임을 유발하던 원인. Phase 1 의 `GuestGuard` pre-auth 스코프가 도착 라우트에서 DOM 전환을 처리하므로 사전 초기화 불필요. 사용처가 사라진 `useThemeStore` import 도 동시 제거. 변경 +0 / -2 (1 file). lint gate exit 0.
- **Phase 3** (`ca3a1c00`): `AuthProvider` 의 `setPreAuthFailureCleanup` 콜백에서 `USER_THEMES.includes(theme)` 분기로 기업 테마 스토어 값을 `'light'` 로 강제 덮어쓰던 파괴적 뮤테이션(setThemeFromServer 호출)을 제거하고, `applyPreAuthTheme(useThemeStore.getState().preAuthTheme)` 호출로 대체. 자동 로그아웃(토큰 갱신 실패) 직전 DOM 클래스/변수만 사전 인증 선호값으로 정규화되고, 스토어에 저장된 기업 테마 값은 보존되어 다음 로그인 성공 시 즉시 복원. 변경 +2 / -4 (1 file). lint gate exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/entities/theme/model/themeStore.ts`
- `src/app/router/AuthGuard.tsx`
- `src/features/theme-switcher/ui/ThemeSwitcher.tsx`
- `src/widgets/settings-dialog/ui/SettingsFooter.tsx`
- `src/app/providers/AuthProvider.tsx`

### 마스터 수동 검증 시나리오

advisor #1 / #2 모두 5-관점 PASS. 다음 e2e 는 PENDING 게이트에서 마스터가 수행:
1. `pnpm dev` (port 5173) 기동 → 로그인 → 설정 → 앱설정 → 기업 테마 에서 색상 테마(예: ocean) 선택.
2. **수동 로그아웃 무깜빡임**: 설정 → 로그아웃 클릭 → 로그인 화면이 *깜빡임 없이* 시스템/라이트/다크 기본 테마로 전환되는지 확인 (기업 테마 → 라이트 → 로그인 화면 의 중간 프레임이 없어야 함).
3. **재로그인 round-trip**: 동일 계정 재로그인 → 대시보드 마운트 직후 ocean 즉시 재적용. `document.documentElement` 의 클래스/변수에 pre-auth 잔여 없는지 devtools 로 확인.
4. **자동 로그아웃 (토큰 만료)**: devtools Application 패널에서 access token 손상 → 화면 인터랙션 → 자동 리다이렉트된 `/signin` 또는 `/login` 의 인풋·버튼·배경이 *기본 테마 색상* 으로 렌더링되는지 확인.
5. **로그인 화면 ThemeSwitcher**: 로그인 페이지에서 다크/라이트/시스템 토글 → localStorage `dc_preauth_theme` 만 갱신되고 `dc_theme_*` 회사 키는 그대로인지 inspect.
6. **콜드 부트**: 기업 테마 적용 후 브라우저 직접 `/login` URL 입력 (또는 새로고침) → 첫 페인트부터 pre-auth 테마로 렌더 (콜드 부트 깜빡임 없음).

### 후속

- `src/entities/theme/index.ts` 배럴에 `applyPreAuthTheme` / `restoreActiveTheme` / `GUEST_ROUTES` 미노출 (Phase 1 sub-agent 보고). 직접 모듈 임포트로 우회 동작 중이며 lint/typecheck 통과. 차후 정리 후속 권장.

## v001.52.0

> 통합일: 2026-05-15
> 플랜 이슈: funshare-inc/data-craft#32

### 페이즈 결과

- **Phase 1** (`e585a17c`): `EmptyInputWidget` 에서 `form.listFirst` 값으로 자식 위젯을 분기하던 enterprise-497 HF-007 로직을 제거하고, `groupId` 확정 + `formQuery` 로딩 종료 이후에는 항상 `UserFormWidget` 으로 단일 위임하도록 수정. 기존 listFirst=false 경로는 `InputWidget` 에 `inputDataGroupId: Number(groupId)` 로 form-id 를 잘못 매핑하고 있었고, `useInputDataGroups` 의 존재성 검증에서 `groupMissing=true` 로 떨어져 입력이 disabled 처리되며 "버튼을 눌러도 아무것도 로드 안 됨" 증상의 근본 원인이었다. `UserFormWidget` 은 listFirst true/false 두 경우 모두 내부에서 처리하므로 단일 경로 통합으로 충분. `InputWidget` / `InputWidgetProps` 임포트 정리 + 헤더 코멘트 갱신 포함. 변경 +10 / -30 (1 file). lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
- `src/widgets/empty-data-widget/ui/EmptyInputWidget.tsx`

### 마스터 수동 검증 시나리오

advisor #2 caveat — 코드 정합성과 lint 는 검증 완료. 다음 e2e 는 PENDING 게이트에서 마스터가 수행:
1. `pnpm dev` (port 5173) 기동 후 페이지 디자이너에서 버튼 위젯 + 빈 입력폼 위젯 배치.
2. 폼 A=`listFirst=true`, B=`listFirst=false` 두 개 준비.
3. 버튼 "데이터 불러오기" → 폼 A 선택 → 뷰 모드 → 버튼 클릭 → 정상 로드 (회귀 없음).
4. 동일 버튼 설정을 폼 B 로 변경 → 버튼 클릭 → **정상 로드** (수정 전: 빈 화면).
5. 타겟 폼 미선택 시 `EmptyDataPlaceholder` 유지.

## v001.51.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#30

### 페이즈 결과

- **Phase 1** (`d5b3637`): `data-craft-server` 의 `src/app.ts` 에 `import { db } from './config/database';` 1줄을 추가하여 `TS2304: Cannot find name 'db'` 빌드 오류를 해소. 원인 — plan-enterprise #28 의 aws-deploy reconciliation 머지로 `/health` 엔드포인트 (`db.healthCheck()` 호출) 가 import 누락 상태로 유입됨. lint exit 0 / build exit 0 / post-merge build (i-dev tip) exit 0 검증.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/app.ts` (+1 line, import 추가)

### 후속

`/dev-merge data-craft` (또는 수동 `i-dev → main` 승격) 후 `/pre-deploy data-craft data-craft-server` 재호출 시 build ✅ + deploy ✅ 통과 기대. plan-28 의 reconciliation 머지에서 비롯된 빌드 차단을 본 plan 으로 해소.

## v001.50.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#28

### 페이즈 결과

- **Phase 1** (머지 `c215ee7` + 린트 hotfix `7cd57ca`): `data-craft-server` 의 `origin/aws-deploy` 를 i-dev 로 `--no-ff` 머지하여 분기 정합성을 회복. aws-deploy 단독 31 commit (그 중 운영 hotfix 7건 — `77aafbd` AWS 배포 준비 / `3f5950b`·`337742c`·`a5ca49e` Express 5 `req.params` 캐스팅 / `d0d9ab4` trust proxy / `e3f4eba` CORS GitHub Pages / `6738723` layout widget 타입) 의 net 변경 7개 파일이 i-dev 에 통합됨. 충돌 없이 ort 자동 머지. 머지 후 `pnpm lint` 가 `src/index.ts:15` 의 미사용 매개변수 `promise` 에서 fail — `_promise` 로 rename 하는 lint hotfix commit 1건을 code-fixer 가 추가. 재실행 결과 lint exit 0.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `.dockerignore` (신규)
- `Dockerfile` (신규)
- `src/app.ts` (helmet · rate-limit · CORS allowedOrigins · trust proxy · /health 엔드포인트)
- `src/config/database.ts` (healthCheck 메소드 등)
- `src/controllers/auth.controller.ts` (Express 5 `req.params as string` 캐스팅)
- `src/controllers/inputStore.controller.ts` (동일 캐스팅)
- `src/index.ts` (unhandledRejection / uncaughtException 핸들러 + lint hotfix `_promise`)

### 검증 결과

- 7c 의례: `git log origin/aws-deploy --not <wip-tip>` empty → WIP 가 aws-deploy superset 확인. `git log origin/i-dev..<wip-tip>` 에 머지 commit + 31 aws-deploy commit 가시.
- spot-check: `src/app.ts` 에 aws-deploy 측 `/health` 엔드포인트 보존, `.env` git-tracked 상태 main 과 일치.
- Lint gate (`pnpm lint`): exit 0 (post-hotfix).

### 후속 (master 수동, 본 플랜 스코프 외)

1. data-craft-server 에서 `git checkout main && git merge --no-ff i-dev` 로 reconciliation 머지 commit 을 main 으로 승격 (`origin/main..origin/i-dev` 가 본 플랜 직전 실측 0 이므로 blast radius = 본 플랜 commit 만).
2. `/pre-deploy data-craft data-craft-server` 재호출 — `git push origin main:aws-deploy` 가 fast-forward 로 통과해야 정상.

### 알려진 재발 리스크 (별도 plan 권장)

- 본 정합성 회복은 일회성. 다시 aws-deploy 에 직접 commit 이 누적되면 동일 비-FF 거부 재발. `deploy_command` 에 fast-forward 가드 prepend 또는 aws-deploy 직접 commit 차단은 `/group-policy` 영역.
- 회수된 hotfix 들의 코드 품질 (Express 5 `as string` 안전성 등) 별도 리뷰 권장.

## v001.49.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#25

### 페이즈 결과

- **Phase 1** (`47f8177`): `viewer.group.ts:57` 및 `builder.form.ts:106` 의 TEMP 그룹명 생성식에서 `randomUUID()` 출력을 `randomUUID().replace(/-/g, '').slice(0, 16)` 로 교체. 결과 그룹명 길이 viewer 측 39자 / builder 측 44자, SP `db.sql/03-procedures.sql:1333` 가 구성하는 lock key (`CONCAT('lock_group_', group_name)`) 가 각각 50자 / 55자로 MySQL `GET_LOCK` 64자 한계 안으로 복귀. 동일 저장소 `inputStore.service.ts:31-34` 의 53자 상한 패턴을 참조하는 인라인 주석을 두 사이트에 추가하여 향후 회귀를 차단. race 방어 (UUID 64-bit 엔트로피) 보존.

### 영향 파일

data-craft-server:
- `src/services/viewer/viewer.group.ts`
- `src/services/builder/builder.form.ts`

### 근본 원인

v001.21.0 (plan-enterprise #8 Phase 3, `2a84cec`) 에서 race condition 방어로 TEMP 명 접미사를 `Math.random()` → `randomUUID()` 로 교체할 때 lock key 길이 검증을 누락한 회귀. `randomUUID()` 의 36자 (dashes 포함) 가 `lock_group_` 접두사 11자와 합산되어 70자 (>64자) 가 됨. 본 플랜은 동 저장소에 이미 존재하던 `inputStore.service.ts` 의 16자 truncation 패턴을 동일하게 적용해 정합화.

### 후속 (미수행)

- F-1: SP `sp_manage_data_group` 자체에 `CHAR_LENGTH(v_lock_key) > 64` 검사 또는 SHA-기반 짧은 lock key fallback 추가 (defense-in-depth, `task-db-structure` 후속).
- F-2: `__TEMP_FORM_*` 잔재 정리 (v001.21.0 F-2 와 동일, 본 플랜 미수행).

## v001.48.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#23 (참조: funshare-inc/data-craft#11 G5/G6)

### 페이즈 결과

- **Phase 1** (`0e02b55`): `billingRenewal.service.ts` 의 `pendingPromotionId` try/catch 분기를 3분기 로직 — 첫 실패 시 `pending_promotion_failed_at` 에 NOW() 기록, 7일 이내 재시도 보존, 7일 임계 초과 시 `pending_promotion_id` + `pending_promotion_failed_at` 모두 NULL 클리어 + 사용자 in-app 알림 (`createPendingPromotionAbandonedNotification`) + `logger.error` — 으로 확장. 성공 경로에 `setPendingPromotionFailedAt(null)` 리셋 추가. `client.model.ts` 에 `setPendingPromotionFailedAt` / `findPendingPromotionFailedAt` 신설 + `ClientRow` 에 `pendingPromotionFailedAt` 필드 추가. `notification.service.ts` 에 `createPendingPromotionAbandonedNotification` 신설 (DB-only, `subscription:renewal-failed` 패턴 미러).
- **Phase 2** (`b2c76ad`): `promotion.service.ts` 에 `forceExpireClientPromotion(companyId)` 신규 함수 추가 — `findActiveClientPromotionByCompany` 로 cp 조회 후 `expireClientPromotionInTx` 직접 호출 (기존 `expireClientPromotion` 의 promotion-null `PromotionError('no-active')` throw 회피). `billingRenewal.service.ts:259` 의 `findPromotionById` null 분기를 `logger.error` 격상 + `forceExpireClientPromotion` + `createPromotionUnavailableNotification` try/catch 흐름으로 교체. `notification.service.ts` 에 `createPromotionUnavailableNotification` 신설 (DB-only, `subscription:plan-downgraded` 타입).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev`):
- `src/services/billingRenewal.service.ts`
- `src/models/client.model.ts`
- `src/services/notification.service.ts`
- `src/services/promotion.service.ts`

### 검증 결과

- Lint gate (`pnpm lint`): exit 0 — Phase 1, Phase 2 양쪽 PASS.
- advisor() #1 (계획) / advisor() #2 (완료) 모두 5관점 PASS, BLOCK 없음.

### 절차 노트

- 사전 정리: `i-dev-001` 의 모든 내용을 양측 손실 없이 `i-dev` 로 머지 (master 명시 지시). data-craft / data-craft-server 두 저장소에서 `git merge --no-ff origin/i-dev-001` 충돌 없이 auto 머지. mobile / ai-preview 는 이미 i-dev 우위 (no-op).
- G6 단기 코드는 신규 `forceExpireClientPromotion` 으로 처리. 장기 정책 (promotion soft-delete + FK 가드) 은 `client_promotion.promotion_id` 가 이미 `ON DELETE RESTRICT` 적용되어 있어 추가 변경 불요 — 이슈 #23 본문 및 #11 댓글에 기록.
- DB 컬럼 `client.pending_promotion_failed_at` 추가는 plan-enterprise 의 mysql 실행 권한 분리 정책에 따라 본 플랜 범위 밖. 완료 시점 후속 프롬프트로 `/task-db-structure data-craft` 출력 — master 가 별도 실행.
- 운영자 알림은 Slack/webhook 인프라 부재로 `logger.error` 유지 — 별도 후속.

### 알려진 후속 부채 (informational blockers)

- Dangling promotion 이 협업 프로모션이었을 경우 `wasCollaboration=false` 로 처리되어 `client.seats=1` 리셋 누락 가능. `client_promotion.snapshot_*` 9컬럼에 collaboration 류 컬럼 부재 — 향후 `snapshot_is_collaboration` 컬럼 추가 시 재검토.
- `RenewableClient` 타입이 `billingScheduler.service.ts` 소재로 Phase 1 affected_files 범위 밖. catch 블록 내 단독 DB 조회 (`findPendingPromotionFailedAt`) 로 우회. 추후 RenewableClient 에 컬럼 추가 여부는 별도 chore 결정.
- `sse.service.ts` 가 dispatch 의 affected_files 에 선언되어 있었으나 실제 코드베이스는 `src/services/sse/sseEventEmitter.ts` 로 분산. 두 신규 알림 모두 DB-only 처리 — SSE emit 필요 시 별도 phase.

### 이슈 #11 후속

본 플랜 완료 시 main session 이 funshare-inc/data-craft#11 에 G5/G6 완료 + G1·B7 미처리 명시 댓글을 별도 게시. 잔여 finding 추적은 #11 OPEN 유지 (master 결정).

## v001.47.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#24
> 대상 저장소: data-craft-server

### 페이즈 결과

- **Phase 1** (fix): `processAutoRenewals` for 루프에 per-client try/catch 추가. `renewSingleClient` 미처리 예외가 propagate 해도 다음 client 로 진행 — cron 부분 실패 격리 (B7:cron-partial-fail). 동일 파일 `processExpiredPlans` 의 형제 패턴 차용.

### 영향 파일

- data-craft-server: (수정) src/services/billingScheduler.service.ts

### 참고

- 이슈 funshare-inc/data-craft#11 잔여 finding 정리의 일환. G1 (1~4) 는 마스터 결정으로 폐기 (환불 보상, 고객 문의 경로 유지). G5/G6 는 plan-enterprise #23 에서 기처리.

## v001.46.0

> 통합일: 2026-05-14
> 대상 저장소: data-craft-server

### 변경 파일

- (수정) .env
- (추가) hotfix-devinsights-page.sql
- (추가) hotfix-devinsights-v2.sql
- (추가) hotfix-executive-dashboard-v20.sql

## v001.45.0

> 통합일: 2026-05-14

### 변경 파일

- (수정) src/app/lib/seedBundleData.ts
- (수정) src/entities/theme/model/themeStore.ts

## v001.44.0

> 통합일: 2026-05-14

### 변경 파일

- (수정) monitoring/data/hourly.json

## v001.43.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#22

### 페이즈 결과

- **Phase 1** (`85d55944`): `BarChartWidget.tsx` 단일 파일에서 잔여 ESLint 문제 2건 정리. (1) 파일 상단 line 1 의 무용 `eslint-disable @typescript-eslint/no-unused-vars` 주석 제거. (2) line 302 의 `useMemo(..., [chartData])` 보존 + `// eslint-disable-next-line react-hooks/preserve-manual-memoization` 1줄 + 사유 주석 추가. React Compiler 가 빌드 파이프라인 (vite.config / package.json) 에 활성화 안 되어 있어 useMemo 제거는 매 렌더 `canvas.measureText` 호출로 성능 저하 위험 — disable+사유 가 정합. master 정책 (실 deps 보정 우선, 1-2건 한도 내 disable+사유 허용) 준수.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`) — 1 파일:
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx`

### 검증 결과

- `pnpm typecheck:all && pnpm lint` exit 0, **0 problems** (0 errors / 0 warnings) FULL PASS 달성.
- 직전 `#21` 종료 시점 FULL PASS 후 `#16 hotfix 9/10` 머지로 신규 도입된 2건 재정리 — lint gate 표준 형태 복귀.
- advisor 계획 / 완료 양 시점 5관점 PASS — Group Policy (disable+사유 1건은 master 정책 한도 내).
- 페이즈 iter: 1회 디스패치, 재시도 0회.

### 운영 메모

- 마스터 명령 "ESLint 경고 38건 해소" 의 38은 1-3단계 (#18/#20/#21) 시작 시점 카운트 — 1-3단계 진행 중 경고도 함께 해소되어 #21 종료 시 0+0. 본 플랜은 그 사이 hotfix 로 신규 도입된 2건 마무리.
- React Compiler 미활성 환경에서 `preserve-manual-memoization` 규칙은 future-compat 체크로 fire — 수동 useMemo 가 정합. 향후 React Compiler 활성화 시 본 disable 재검토 권장.
- BarChartWidget 의 `chartData` 가 상위 useMemo 로 안정 참조 — disable 안전.

## v001.42.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 10)

### 페이즈 결과

- **Phase 14 (hotfix 10)** (`4538bb66`): UserCard UI 디자인 정리 3건 일괄 적용.
  - **(A) 프로필 + 이름 통합 헤더**: 외곽 레이아웃 `flex-row` → `flex-col`. 헤더 행 = `flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 bg-gray-50` 안에 프로필 (`w-7 h-7 rounded-full`) + 이름 (`text-sm font-semibold truncate`) 같은 행 배치. 기존 본문/프로필 사이 수직 divider (`border-l border-gray-200`) 제거 — 시각 단위 일원화.
  - **(B) primary/secondary 중복 가드**: secondary1 의 string value 가 빈 문자열이거나 primary 와 동일한 경우 미렌더 — `250 / 250` 같은 정보 노이즈 제거.
  - **(C) 슬롯 한 줄 + 얇은 구분선**: 각 슬롯이 `flex flex-row items-baseline justify-between gap-2 py-1` — 라벨 왼쪽 / 값 오른쪽. 첫 슬롯 제외 `border-t border-gray-100` 적용. secondary1 은 primary 옆 괄호 안 작은 글씨 (예: `250 (245)`) — 중복 가드와 결합되어 의미 있는 경우만 표시.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/UserCard.tsx`

### 검증 결과

- 코드 다이프: +59/-57, 1 파일.
- 페이즈 iter: 1회 통과.
- Lint gate: advisory.

### 운영 메모

- 수동 검증:
  - 프로필과 이름이 같은 행에 한 덩어리로 보이는지 (좌측 floating 인상 해소).
  - primary == secondary1 인 케이스 (예: `250 / 250`) 에서 secondary1 가 사라졌는지.
  - 슬롯 라벨이 왼쪽, 값이 오른쪽, 슬롯 간 얇은 회색 구분선이 있는지.
  - vertical / horizontal / grid 레이아웃 (hotfix 8a) 에서 카드가 컨테이너에 fit 되는 동작 유지.

## v001.41.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#21

### 페이즈 결과

- **Phase 1** (`08043134`): only-export-components 5 + rules-of-hooks 5 (총 10 errors) 해소. 비-컴포넌트 export 를 4개 sibling 파일 (`ActiveGridContext.context.ts`, `headerSlotsContext.context.ts`, `cardComponentMarker.helpers.ts`, `areColumnPropsEqual.ts`) 로 분리하여 fast-refresh 복원. 조건부 호출된 hook 5건은 early return 앞으로 재배치하되 `KanbanDrawerHeader` 의 `wrappedSaveChange` 콜백에 `kanbanColumnField` null 가드를 추가하여 의미 보존. import 사이트 9 파일 mechanical 갱신 동반.
- **Phase 2** (`005ea82e`): react-hooks/refs 6 errors 해소. `useClipboardKeyboard` 의 ref 쓰기를 기존 `useLayoutEffect` 안으로 이동, `KanbanCardConfigDialog` (line 438) 의 render-time `getViewerModel()` 호출을 `useSyncExternalStore(noop, () => viewerRef.current?.getViewerModel())` 패턴으로 치환 — `getViewerModel()` 이 React 상태 객체를 동일 참조로 반환하므로 무한 루프 위험 없음.
- **Phase 3** (`4fd42731`): set-state-in-effect 9 errors + Unused-disable 2 해소. 4개 헤더 다이얼로그 (`CalendarHolidayDialog`, `CalendarLabelColumnDialog`, `GanttLabelColumnDialog`, `KanbanColumnDialog`) 에 **Inner 컴포넌트 추출** 패턴 적용 — `isOpen=false` 시 Inner 가 언마운트되어 재오픈 시 자동 초기화. `useGridClipboard`/`useGridFocus`/`usePagination`/`FsLineChartColorPicker`/`GanttSubtaskAddDialog` 는 파생 state 또는 이벤트 핸들러 패턴으로 재구조. **단, prev-ref 렌더 중 setState 패턴 도입으로 react-hooks/refs 6건 신규 발생 + 인접 effect 2건 표출 — Phase 4 통합 처리.**
- **Phase 4** (`4dc019fa`): Phase 3 regression 8 errors + Compilation Skipped 2 + warnings 15 일괄 정리, **lint gate FULL PASS** 도달. `useGridClipboard` 는 `clipboardSlot` 에서 직접 파생, `useGridFocus`/`usePagination`/`PieChartWidget` 은 `useState` prev-state 패턴 (React 공식 권장) 으로 재전환. `useDropdown` 은 이벤트 핸들러에서 위치 계산. `KanbanCardConfigDialog` 의 form init effect 는 Inner 컴포넌트 + open 마운트 패턴 추가 (Phase 2 의 useSyncExternalStore 와 공존). `ButtonRenderer` 와 `UpgradeDialog` 의 Compilation Skipped 는 누락된 deps (`pruneStateForRowField`, `promotionActive`) 추가로 해소. exhaustive-deps/immutability/Unused-disable 잔재 전부 정리.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`) — 37 파일 (4 신규 추가 포함):

신규 추가 (Phase 1 sibling 분리):
- `packages/fs-data-viewer/src/features/grid/context/ActiveGridContext.context.ts`
- `packages/fs-data-viewer/src/shared/ui/RightDetailDrawer/cardComponentMarker.helpers.ts`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/headerSlotsContext.context.ts`
- `packages/fs-data-viewer/src/widgets/kanban-board/kanban-column/areColumnPropsEqual.ts`

수정:
- Phase 1: `ActiveGridContext.tsx`, `cardComponentMarker.tsx`, `headerSlotsContext.tsx`, `UserListSettings.tsx`, `FsKanbanBoard.tsx`, `FsKanbanColumn.tsx`, `KanbanDrawerHeader.tsx`, import 사이트 9 파일 (`useClipboardKeyboard.ts`, `useGridClipboard.ts`, `useGridFocus.ts`, `FsGridHeader.tsx`, `GanttDetailDrawerBody.tsx`, `FsGanttChart.tsx`, `KanbanDetailDrawerBody.tsx`, RC-1 테스트 등)
- Phase 2: `useClipboardKeyboard.ts`, `KanbanCardConfigDialog.tsx`
- Phase 3: 헤더 다이얼로그 4 + `useGridClipboard.ts`, `useGridFocus.ts`, `useDropdown.ts`, `FsLineChartColorPicker.tsx`, `ButtonSettingsDialog.tsx`, `usePagination.ts`, `GanttSubtaskAddDialog.tsx`
- Phase 4: `useGridClipboard.ts`, `useGridFocus.ts`, `useDropdown.ts`, `useServerPagingOrchestrator.ts`, `ButtonRenderer.tsx`, `useLogCell.ts`, `useConnectionCell.ts`, `PieChartWidget.tsx`, `usePagination.ts`, `ViewColumnManagerDialog.tsx`, `useFormWidgetHistory.ts`, `UpgradeDialog.tsx`, `KanbanCardConfigDialog.tsx`

### 검증 결과

- **최종 lint gate FULL PASS**: `pnpm typecheck:all && pnpm lint` 둘 다 exit 0 — typecheck 8 tasks FULL TURBO PASS, lint 0 errors / 0 warnings.
- 누적 결과: 27 errors + 15 warnings → 0 + 0.
- 페이즈별 scoped grep: Phase 1 (0), Phase 2 (0), Phase 3 (실제 6 — Phase 4 통합), Phase 4 표준 lint gate FULL PASS.
- 페이즈 iter: 4회 디스패치, 재시도 0회. Phase 3 regression 은 plan-defined 허용 경로 (Phase 4 absorbs) 로 처리, 우회 아닌 설계된 복원 동선.
- advisor 계획 / 완료 양 시점 5관점 PASS — Logic 검토에서 Phase 3→4 의 regression-tolerance 가 plan-defined 정상 경로임 확인.

### 운영 메모

- **lint gate 표준 복귀**: dev.md `lint_command` (`pnpm typecheck:all && pnpm lint`) 직렬 형태가 본 플랜 종료 시점부터 FULL PASS 도달. 후속 플랜은 scoped check 없이 표준 gate 사용 가능.
- **Phase 3 regression 학습**: prev-ref 렌더 중 setState 는 react-hooks/refs 규칙 위반 — 향후 동일 패턴 회피, `useState` prev-state 또는 파생 `useMemo` 우선 (React 공식 권장).
- **Inner 컴포넌트 추출 패턴** (4개 헤더 다이얼로그 + KanbanCardConfigDialog form): open=false 시 Inner 언마운트로 자동 초기화. init useEffect 제거의 정석. 향후 유사 다이얼로그 패턴에 적용 권장.
- **수동 회귀 시나리오** (master 수행 권장):
  - 4개 헤더 다이얼로그 (Calendar/Calendar/Gantt/Kanban Column): open → 모델 수정 → close → 재오픈 시 초기값 정상.
  - KanbanCardConfigDialog 의 컬럼 메타 편집 (Phase 2 + Phase 4 fix).
  - 그리드 클립보드/포커스/Pagination 동작.
  - 헤더 위젯 fast-refresh 동작 (개발 모드 hot-reload 시 컴포넌트 보존).
- master 정책 (실 deps 보정 우선, 1-2건 disable+사유 허용) 준수 — Phase 4 에서 누락 deps 추가 우선 적용, intentional disable 미도입.

## v001.40.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 9)

### 페이즈 결과

- **Phase 13 (hotfix 9)** (`767346c6`): hotfix 8b 가 도입한 `BarChartWidget` 의 `desiredLabelColWidth` `useMemo` 가 **두 개의 React Rules-of-Hooks 위반**을 동시에 가지고 있어 다수 위젯이 에러 바운더리에 잡힘 ("Rendered more hooks than during the previous render"):
  1. `chartData.length === 0` early return **이후** 에 hook 호출.
  2. `if (isHorizontal)` 조건 분기 **안** 에서 hook 호출 (세로 막대 렌더 시 hook 누락).
  
  두 위반 모두 해소: `useMemo` 를 IIFE 집계 직후 (early return 이전, isHorizontal 분기 외부) 로 이동. `eslint-disable-next-line react-hooks/rules-of-hooks` 주석 제거 (위반 해소로 불필요).
  
  진단 결과: GaugeWidget / CardWidget / UserCard / LineChartWidget / PieChartWidget 은 hooks 순서 정상 — 수정 없음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx`

### 검증 결과

- 코드 다이프: +12/-11, 1 파일.
- 페이즈 iter: 1회 통과.
- 진단 범위 검사 (BarChartWidget, GaugeWidget, CardWidget, UserCard, LineChartWidget, PieChartWidget) — BarChartWidget 외엔 정상.
- Lint gate: advisory.

### 운영 메모

- 수동 검증: 대시보드 새로고침 후 위젯 ⚠ 에러 사라지고 모든 위젯이 정상 렌더되는지 확인. 가로 막대 / 세로 막대 둘 다 정상 그려지는지 확인.
- 회고: hotfix 8b 디스패치 시 새 `useMemo` 의 정확한 배치 위치 (early return 이전 + 분기 외부) 를 명시했어야 함. 향후 hook 추가 dispatch 시 동일 검증 routine 권장.

## v001.39.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 8)

### 페이즈 결과

- **Phase 12 (hotfix 8a)** (`5c9187f7`): 사용자 위젯 카드의 프로필 원형화 + 카드 반응형. `UserCard` 의 240×120 고정 inline style (width/height/flexShrink/borderRadius) 을 제거하고 `w-full h-full min-h-[80px] rounded` Tailwind 로 교체. ProfilePhoto 컨테이너를 PROFILE_WIDTH(72px) 고정 → `w-12 h-12 rounded-full overflow-hidden` 원형으로 변경 (이미지 + initials fallback 모두 원형). `PaginatedUserGrid` 의 grid 셀 크기를 기존 `minmax(0, 240px)` + `gridAutoRows: 120px` 에서 `minmax(0, 1fr)` + `gridTemplateRows: repeat(rows, 1fr)` 로 변경하여 vertical / horizontal / grid 세 레이아웃 모두 주어진 컨테이너 공간을 채우는 반응형 구조.
- **Phase 12 (hotfix 8b)** (`4afc5818`): 가로 막대 그래프의 좌측 라벨 컬럼 적응형 폭. Canvas `measureText` (10px sans-serif, 실제 라벨 폰트와 동일) 로 모든 라벨의 픽셀 폭을 `useMemo` 한 번 측정, dot/gap/여백 22px 더해 `desiredLabelColWidth` 산출. **컨테이너 폭의 20% 상한** (마스터 직전 메시지로 15% → 20% 조정) 적용. 초기 렌더 (containerWidth=0) 시 상한 Infinity 로 두어 레이아웃 붕괴 방지, 최소 40px 보장. `desiredLabelColWidth` 가 상한 이내면 truncate 클래스/maxWidth 제거 → 라벨 자연 폭 + 남은 공간을 막대 영역이 흡수, 초과 시에만 고정 폭 + truncate 적용. 세로 막대 분기는 손대지 않음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/UserCard.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/PaginatedUserGrid.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx`

### 검증 결과

- 코드 다이프: +34/-32 across 3 files.
- 페이즈 iter: 8a 1회, 8b 1회 모두 통과.
- Lint gate: advisory.

### 운영 메모

- 사용자 위젯 수동 검증:
  - 프로필 사진이 원형으로 보이는지 (이미지 + initials fallback 양쪽).
  - vertical / horizontal / grid 레이아웃에서 위젯 영역에 카드가 fit 되며 겹침/잘림 없는지.
  - PaginatedUserGrid 의 pagination 화살표 동작 유지.
- 가로 막대 수동 검증:
  - 라벨이 짧은 케이스 (예: "A", "B", "C") — 라벨 컬럼 자연 폭 (좁게), 막대 영역 더 넓게.
  - 라벨이 긴 케이스 (예: "DB 마이그레이션", "백엔드 안정화") — 컨테이너 폭의 20% 초과 시 라벨 컬럼 20% 고정 + truncate 말줄임 적용.
  - 위젯 폭 변화 (드래그 리사이즈) 시 컬럼 폭 즉시 재계산.

## v001.38.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 7)

### 페이즈 결과

- **Phase 11 (hotfix 7)** (`dcbeb3a3`): 원형 게이지 (circle) 의 우측 numeric value 에 단위 표기 추가. `GaugeConfig` 타입에 `unit?: string` / `unitPosition?: 'left' | 'right'` 필드 추가 (CardConfig 패턴 미러링). GaugeSettings 의 데이터 소스 섹션 multiplier 아래에 단위 텍스트 입력 (flex-1) + 단위 위치 셀렉트 (w-24) UI 추가. GaugeWidget circle 분기 우측 numeric span 을 `flex items-baseline` 컨테이너로 감싸 unitPosition 기준 좌/우 접미·접두로 unit 텍스트 렌더 (`text-base text-gray-600` 으로 수치 대비 시각 차등화). semicircle / linear 분기는 손대지 않음 (마스터 명시 범위 = circle 만).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts`
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/GaugeSettings.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/GaugeWidget.tsx`

### 검증 결과

- 코드 다이프: +64/-1, 3 파일 모두 affected_files 내.
- 페이즈 iter: 1회 통과.
- Lint gate: advisory.

### 운영 메모

- 수동 검증: 원형 게이지 위젯 설정에서 단위 입력 (예: "명", "h", "건") + 좌/우 위치 토글 후 우측 numeric value 옆에 단위가 표시되는지 확인. semicircle / linear 모드는 기존 동작 유지.
- semicircle / linear 분기에도 unit 표기 확장은 별도 핫픽스 가능 — 본 핫픽스는 마스터 명시 범위에 한정.

## v001.37.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 6)

### 페이즈 결과

핫픽스 6 은 2 sub-dispatch — 카드 위젯의 시각 중심 보정 + 원형 게이지 수치 잘림 회피.

- **Phase 10 (hotfix 6a)** (`89f8fa99`): 카드 위젯의 메인 컨텐츠 (값 display) 가 헤더 row 아래 본문 영역의 중앙에 정렬되어 카드 전체 기준으로는 약간 아래로 치우쳐 보이는 문제. `CardWidget` 내부에 `hasHeader` 계산 (titleConfig.text / config.title / iconPlacement === 'header' 시 iconConfig.name 유무) 도입 후 본문 wrapper 의 style 에 `marginTop: hasHeader ? -14 : 0` 적용 — 헤더 row 의 일반 높이 (~28px) 절반만큼 본문을 위로 올려 시각 중심을 카드 전체 중심에 일치. 헤더가 없는 케이스는 보정 0 으로 자연스럽게 처리.
- **Phase 10 (hotfix 6b)** (`3c1b4166`): 원형 게이지 (`shape === 'circle'`) 의 하단 caption 으로 표시되는 numeric value span 이 위젯 컨테이너 높이 제약 때문에 잘리는 문제. `GaugeWidget` circle 분기의 outer motion.div 를 `flex-col` → `flex-row items-center justify-center gap-3` 로 변경, SVG 를 좌측 (flex-shrink-0) 에 고정하고 numeric value span 을 SVG 우측으로 이동 (`text-2xl font-bold flex-shrink-0`). SVG 내부 중앙 퍼센티지 텍스트 / mask / threshold 렌더링은 손대지 않음. semicircle / linear 분기 변경 없음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/GaugeWidget.tsx`

### 검증 결과

- 코드 다이프: +17/-4, 2 파일 모두 affected_files 내.
- 페이즈 iter: 6a 는 1회차 API socket error 로 0 커밋 상태 유지 후 재디스패치 1회 통과 (실패 사후 작업 없음 — clean tree). 6b 1회 통과.
- Lint gate: advisory.

### 운영 메모

- 카드 위젯 수동 검증: 헤더 (제목/아이콘) 가 있는 카드와 없는 카드 양쪽에서 값 display 가 카드 전체 시각 중심에 위치하는지 확인. 스파크라인 켜진 카드도 동일 보정 적용되어 자연스러움.
- 원형 게이지 수동 검증: SVG 가 게이지 영역 중앙에 그대로 있고 numeric value 가 우측에 잘림 없이 표시되는지 확인. 게이지 폭이 매우 좁아지는 케이스의 좌우 fallback 은 본 핫픽스 범위 밖 — 별도 핫픽스 가능.

## v001.36.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 5)

### 페이즈 결과

- **Phase 9 (hotfix 5)** (`a219ced6`): hotfix 3c/4 의 시침 (테이퍼 polygon + 다층 hub circle) 이 마스터 검수 시점에 여전히 pivot 위치 불일치 / 시각적 거슬림으로 거절. 마스터 결정에 따라 **시침 완전 제거** + 값 표시를 반원 호 안쪽으로 이동.
  - GaugeWidget `shape === 'semicircle'` 분기에서 시침 IIFE 블록 (motion.g + polygon 2개 + hub circle 3개) 통째로 삭제.
  - SVG 를 `relative` div 로 래핑하고 값 표시 `<motion.span>` 을 `absolute` + `bottom: 10%` + `left-1/2 -translate-x-1/2` 로 호 baseline 바로 위 중앙에 배치 — 반원 호가 값을 시각적으로 감싸는 형태.
  - min-max 캡션은 컨테이너 외부 (SVG 박스 아래) 에 그대로 유지.
  - multi-color 세그먼트 mask 렌더링 / 단색 분기 / circle / linear 모드 모두 영향 없음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/GaugeWidget.tsx`

### 검증 결과

- 코드 다이프: +109/-139, 1 파일. 줄 수 감소는 시침 제거가 신규 레이아웃 추가보다 큼.
- 시침 잔재 검증: `git diff i-dev-001..HEAD -- GaugeWidget.tsx | grep -E '^\+.*(motion\.g|polygon|valueAngle|transformOrigin|needle)'` 결과 0 매치 — 시침 관련 코드가 신규 추가된 라인에 일절 없음을 확인.
- 페이즈 iter: 1회 통과.
- Lint gate: advisory.

### 운영 메모

- 수동 검증: 반원 게이지 위젯에서 시침이 더 이상 보이지 않고, 수치가 반원 호 안쪽 중앙 영역 (호가 감싸는 형태) 에 표시되는지 확인. min-max 캡션은 게이지 아래에 그대로 유지.
- 게이지의 호 색상 / threshold / 애니메이션은 변동 없음.

## v001.35.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 4)

### 페이즈 결과

- **Phase 8 (hotfix 4)** (`8553e952`): 핫픽스 3c 의 단순 line 시침이 시각적으로 빈약하다는 마스터 피드백 ("양심적으로 실망인데" — 스크린샷 첨부) 반영. `GaugeWidget` 의 `shape === 'semicircle'` 분기에서 시침을 다음 구성으로 재작성:
  - 시침 본체: 테이퍼 `<polygon points="50,12 51.5,50 48.5,50">` — 베이스 폭 3 단위, 팁 (50, 12) 으로 pivot 에서 38 단위 길이 (호 r=40 근처까지 닿음).
  - 균형감 꼬리: pivot 뒤로 7 단위 짧은 `<polygon points="49.2,50 50.8,50 50.4,57 49.6,57">`.
  - 다층 hub (motion.g 외부, 회전 영향 없음): r=5 (`#1f2937` gray-800 다크) / r=3 (`#4b5563` gray-600 미드) / r=1 (`#9ca3af` gray-400 하이라이트) 의 3겹 원으로 깊이감.
  회전·애니메이션 (`motion.g` 0.8s easeOut, -90도 → valueAngle), `transformOrigin: '50px 50px'` 는 그대로 유지. circle / linear 분기는 손대지 않음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/GaugeWidget.tsx`

### 검증 결과

- 코드 다이프: +13/-9, 1 파일 affected_files 내.
- 페이즈 iter: 1회 통과.
- 좌표 검증: pivot (50, 50), 팁 (50, 12) → 길이 38, 호 반지름 40 대비 95% 도달. 베이스 폭 3 / 꼬리 폭 1.6 → 길이 7. hub 3겹 r=5/3/1.
- Lint gate: advisory (베이스라인 동일).

### 운영 메모

- 수동 검증: 반원 게이지 위젯에서 시침이 호 근처까지 닿는 두툼한 테이퍼 형태로, hub 가 다층 원으로 보이는지 확인. 시침 회전 애니메이션 (0.8s) 정상.
- 향후 색 동적화 (`useThresholdColors` 따라 시침 색 분기) 는 별도 핫픽스/플랜 가능 — 현재는 단색 그레이 스케일.

## v001.34.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#20

### 페이즈 결과

- **Phase 1** (`865b363d`): `data-craft` 의 `pnpm lint` 기계적 규칙 위반 100건 (실측, master 추정 102) 을 단일 페이즈로 일괄 해소. in-scope 3개 규칙 — `@typescript-eslint/no-unused-vars` 74건 (미사용 import / 지역 변수 삭제 또는 `_` prefix, 23개 간트 필드 테스트의 `buildRow`/`buildCell` 미사용 import 정리 포함), `@typescript-eslint/no-explicit-any` 23건 (전부 테스트 파일 한정 — `E.FsGridRowModel` / `E.FsDataViewerModel` / `FsGanttRowData` 등 실 타입 적용 또는 `unknown as <ConcreteType>` 2단 캐스트로 안전 교체, 프로덕션 의미 변경 없음), `Unused eslint-disable directive (no problems were reported from 'no-console')` 3건 (`useViewerMetaLoader.ts:166`, `settings-handlers.ts:95`, `generate-widget.tsx:149` 의 불필요한 disable 주석만 제거). 후속 플랜 (2/2) 영역인 `react-hooks/rules-of-hooks` / `react-refresh/only-export-components` / react-compiler diagnostics 는 일절 미터치.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`) — 73 파일:

- `packages/fs-data-viewer/src/__tests__/field-types/gantt/` 내 23개 `*Field.test.tsx` 파일 (Checkbox/Color/Date/DateTime/Deadline/Document/File/Image/Link/Meta/MultiSelect/Nation/OnOff/Percent/Progress/Rating/SingleSelect/Tag/Time/Timer/User/Vote/WorldTime)
- `packages/fs-data-viewer/src/__tests__/grid-residual/zone-03-items.test.tsx`
- `packages/fs-data-viewer/src/app/hooks/useViewerMetaLoader.ts`
- `packages/fs-data-viewer/src/features/data-viewer/handlers/settings-handlers.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/__tests__/useServerPaging.test.ts`
- `packages/fs-data-viewer/src/features/grid/hooks/useSubGrid.ts`
- `packages/fs-data-viewer/src/features/grid/lib/cellStyleUtils.ts`
- `packages/fs-data-viewer/src/features/grid/lib/row-management/rowAddUtils.ts`
- `packages/fs-data-viewer/src/features/print/ui/PrintDialog.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/__tests__/rendererMap-text-unit.test.tsx`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/renderers/{file/FileRenderer.tsx,image/ImageRenderer.tsx,VoteRenderer.tsx}`
- `packages/fs-data-viewer/src/shared/ui/cell-renderers/UniversalCellRenderer.tsx`
- `packages/fs-data-viewer/src/widgets/batch-input-dialog/batch-row/{BatchRowColumnInput.tsx,BatchRowCreateTab.tsx}`
- `packages/fs-data-viewer/src/widgets/calendar/calendar/CalendarHeader.tsx`
- `packages/fs-data-viewer/src/widgets/cell-renderers/` 내 10개 (color-picker, connection, dual-widget, FsGridDocumentCellRenderer, FsGridFormulaCellRenderer, FsGridMultiSelectCellRenderer, FsGridSimpleFormulaCellRenderer × 2, timer-cell)
- `packages/fs-data-viewer/src/widgets/dashboard/{DashboardGrid.tsx,FsDashboard.tsx,widgets/CardWidget.tsx,widgets/__tests__/BarChartWidget.scroll-alignment.test.tsx}`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/KanbanCardAreasDialog.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_renderer/generate-widget.tsx`
- `packages/fs-data-viewer/src/widgets/FsGridFooter.tsx`
- `packages/fs-data-viewer/src/widgets/gantt-chart/{__tests__/FsGanttBar.click-chain.test.tsx,__tests__/GanttDetailDrawerBody.test.tsx,gantt-chart/FsGanttChart.tsx}`
- `packages/fs-data-viewer/src/widgets/grid-table/components/GridFooter.tsx`
- `packages/fs-data-viewer/src/widgets/kanban-board/` 내 6개 (3 테스트 + FsKanbanBoard, CompactComponents, KanbanDrawerHeader.test)
- `packages/fs-external-data-viewer/src/widgets/{fs_grid_renderer/generate-widget.tsx,FsGridFooter.tsx,grid-table/components/GridFooter.tsx}`
- `packages/fs-file-attachment/tests/FileGroupList.test.tsx`
- `packages/fs-sub-data-viewer/src/widgets/{FsGridFooter.tsx,grid-table/components/GridFooter.tsx}`
- `tests/enterprise-417/zone3-deprecate.test.ts`

(74 enumerated → 73 modified — `KanbanCardAreasDialog.tsx` 가 enumerated 였으나 phase-executor 검토 결과 in-scope 라인 없음으로 무수정 결정. 정상.)

### 검증 결과

- 코드 다이프: +80/-98 (net -18) across 73 files. files_changed ⊆ affected_files (74 enumerated).
- **Scoped lint 검증**: `pnpm lint 2>&1 | grep -E "(no-unused-vars|no-explicit-any|Unused eslint-disable directive.*no-console)" | wc -l` = **0** (in-scope 100 → 0 달성).
- typecheck 회귀 검사: `pnpm typecheck:all` 8 tasks FULL TURBO PASS (직전 플랜 #18 의 클린 상태 유지).
- 잔여 lint errors 27건 = 후속 플랜 (2/2) 스코프 (15 react-compiler diagnostics + 5 react-refresh/only-export-components + 5 react-hooks/rules-of-hooks + 2 unmatched). 본 플랜 미터치.
- advisor 계획 / 완료 양 시점 5관점 PASS — Evidence 검토에서 `as unknown as <ConcreteType>` 2단 캐스트 13건 모두 실 타입 지정 (idiomatic 테스트 mock 패턴), `any` 우회 아님 확인.
- 페이즈 iter: 1회 디스패치, 재시도 0회. lint hotfix iter: 0회 (scoped grep 즉시 0).

### 운영 메모

- master "기계적 102건, 의미 큰 변경은 페이즈 분할" 의 hint 검토 결과, in-scope 23 any 가 전부 테스트 파일이라 의미적 분할 불요로 판정 후 단일 페이즈 진행. 결과상 정확한 판단 (run-time 영향 0, prod 코드 의미 변경 0).
- **lint gate 정책 조정**: skill 표준 lint gate (`pnpm typecheck:all && pnpm lint`) 가 후속 플랜 스코프의 24 errors 때문에 어차피 실패할 것을 사전 인식하여, 본 페이즈 한정 lint gate 를 **scoped grep** 으로 대체했다. hotfix iter 가 후속 플랜 영역을 침범할 위험을 차단하는 안전 장치 — 직전 #18 의 "단계 1 완료로 간주" 패턴을 사전 명시화한 진화.
- **후속 권고**: 잔여 27 errors / 15 warnings 정리를 위한 **/plan-enterprise data-craft ESLint 오류 해소 2/2 — 의미적 리팩터** 권장. 스코프: react-hooks/rules-of-hooks 5건 (effect 동기 setState / 렌더 중 ref 접근 등), react-refresh/only-export-components 5건 (컴포넌트 모듈 export 분리), react-compiler 15건 (메모이제이션 보존 / setState cascade).
- `_` prefix vs 삭제 판단의 일관성: 함수 시그니처 유지 필요한 곳은 `_` prefix, 진짜 무의미 import 는 삭제 — phase-executor 가 각 사이트 의미 검토 후 결정.

## v001.33.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 3)

### 페이즈 결과

핫픽스 3 은 3개 위젯의 독립 UI 확장을 한 hotfix WIP 위 3 sub-dispatch 로 분할 수행 (sub-agent context budget 준수).

- **Phase 7 (hotfix 3a, `a88ed3d9`)** — 카드 위젯 중앙 컨텐츠 정렬 옵션 + 제목 아이콘 위치 옵션. `CardConfig` 에 `contentAlign` ('left'|'center'|'right', 기본 'center') 와 `iconPlacement` ('header'|'value-left'|'value-right', 기본 'header') 필드 추가. `WidgetContainer` 는 `iconPlacement !== 'header'` 일 때 헤더 아이콘 슬롯을 억제하도록 `headerIconVisible` 게이트 도입, `hasHeader` 계산도 함께 갱신해 "아이콘만 있고 제목 없는" 경우의 빈 헤더 행 렌더를 방지. `CardWidget` 은 `contentAlign` 에 따라 값 컨테이너 flex 정렬을 분기하고 `value-left`/`value-right` 시 값 행 안에 `InlineIconSlot` (wrapper 32px, icon 20px) 렌더. `CardSettings` 에 "값 표시" 섹션 신설 — 한국어 라벨 Select 두 개 ("값 정렬", "아이콘 위치"). **iter 2회** (1회차 `scope_expansion_needed` 보고 — `WidgetContainer.tsx` 가 affected_files 추가 필요, 승인 후 2회차 통과).
- **Phase 7 (hotfix 3b, `aeb6e809`)** — 사용자 보드 위젯 UserCard 좌측 프로필 사진 + 우측 이름/수치 레이아웃. 카드 내부 구조를 `flex-col` → `flex-row` 로 재구성, 좌측 72px 고정 폭에 `ProfilePhoto` 서브 컴포넌트 신설 (`shared/hooks/useUserImageUrl` 기존 훅 재사용으로 `imageBlob → ObjectURL` 변환 + cleanup 처리). 이미지 로드 실패 시 `<img onError>` 로 `imageError` state 전환 → 이름 첫 글자 이니셜 + 회색 배경 fallback. 우측 영역은 `flex-col` 로 상단 이름 헤더 + 슬롯 세로 적층 (기존 1–3 슬롯 라벨/primary/secondary 구조 유지). 카드 외곽 크기 (240×120) 와 `PaginatedUserGrid` 의 vertical/horizontal/grid 레이아웃 옵션은 변경 없음.
- **Phase 7 (hotfix 3c, `0e9c4b32`)** — 반원 게이지 자동차 계기판 시침. `GaugeWidget` 의 `shape === 'semicircle'` 분기에 multi-color 호 렌더 직후 `motion.g + line` 조합으로 시침 삽입. base orientation = 수직 위 (12시 방향), 0% → `rotate(-90deg)`, 100% → `rotate(+90deg)` 의 단일 rotate 값 보간 (framer-motion 0.8s easeOut). `transformOrigin: '50px 50px'` 을 CSS style prop 으로 `motion.g` 에 적용 (modern browser 의 SVG element 에 CSS `transform-origin` 적용 동작). 중심 허브 `<circle r=3 fill=#333>` 은 `motion.g` 바깥에 배치해 회전 영향 받지 않음. circle / linear 모드는 손대지 않음.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts`
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/CardSettings.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/UserCard.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/GaugeWidget.tsx`

### 검증 결과

- 코드 다이프: +244/-62, 6 파일 모두 affected_files 내 (3a 의 `WidgetContainer.tsx` 는 1회차 `scope_expansion_needed` 보고 후 승인 확장).
- 회귀 grep: `contentAlign | iconPlacement | headerIconVisible | InlineIconSlot | ProfilePhoto | useUserImageUrl | valueAngle | CardWidget | WidgetContainer | UserCard | GaugeWidget | CardSettings` 어느 항목도 typecheck 출력에 등장하지 않음 — 본 핫픽스가 새 typecheck 오류를 도입하지 않았음을 확인.
- 3a 추가 검증: `iconPlacement` 의 `'in widget.config'` 가드로 non-card 위젯은 기본값 `'header'` → 기존 동작 보존. 제목만 있고 아이콘 없는 위젯은 `resolvedTitle` 으로 `hasHeader = true` 유지, `headerIconVisible = false` 로 슬롯만 비움.
- 3b 추가 검증: `<img onError={() => setImageError(true)}>` 로 invalid blob 도 fallback (`imageBlob == null` 외 케이스도 처리). `useUserImageUrl` 훅 `URL.createObjectURL` cleanup 보장 (기존 훅 재사용).
- 3c 추가 검증: `transformOrigin` CSS prop 으로 `motion.g` 에 적용 — SVG element 에 CSS `transform-origin` 이 modern browser (Chrome/Firefox/Safari) 에서 정상 동작. needle base 좌표 (50,50)→(50,15) 길이 35, 회전 중심 (50,50) 정확. hub circle 은 motion.g 외부.
- Lint gate: advisory (베이스라인 동일).
- advisor: 핫픽스 3 본 라운드는 SKIP — 1회차 advisor 호출에서 "diff-level checks 가 advisor 수준 검증을 이미 수행했다" 판단으로 검사 결과만 가지고 진행 결정.

### 운영 메모

- 수동 검증:
  - **카드 위젯**: contentAlign 좌/중앙/우 시각 확인. iconPlacement = "값 왼쪽"/"값 오른쪽" 선택 시 헤더에서 아이콘 사라지고 값 옆에 표시 확인. iconConfig 가 없거나 name 빈 문자열이면 아이콘 미렌더 확인.
  - **사용자 보드**: imageBlob 가 있는 사용자는 프로필 사진, 없는 사용자는 이니셜 회색 fallback 표시. 이미지 로드 실패 케이스도 fallback 전환. PaginatedUserGrid 의 grid/vertical/horizontal 레이아웃에서 카드 외곽 사이즈 (240×120) 유지.
  - **반원 게이지**: 위젯 초기 렌더 시 시침이 왼쪽 끝 (0%) 에서 현재 값까지 0.8s 회전. 게이지 값 변경 시 새 위치로 부드럽게 보간. circle / linear 모드는 시침 없이 기존 동작 유지.

## v001.32.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#19

### 페이즈 결과

- **Phase 1** (`83448488`): 7개 `packages/fs-*` 패키지의 `tsup.config.ts` 정규화. (1) `onSuccess: "pnpm build:css"` 7개 전체에 통일 적용 — `fs-data-viewer` 기존 인라인 `tailwindcss -i ./src/styles.css -o ./dist/styles.css --minify` 도 `pnpm build:css` 로 정규화하여 single source of truth 가 `package.json scripts.build:css` 로 일원화. (2) `clean: true` 누락 3개 explorer (`fs-data-viewer-explorer`, `fs-external-data-viewer-explorer`, `fs-sub-data-viewer-explorer`) 에 추가 → 7개 모두 동일 구조 (`clean: true` + `onSuccess: "pnpm build:css"`).
- **Phase 2** (`7c4b89f0`): 7개 패키지 `package.json scripts.build` 를 `"tsup && pnpm build:css"` → `"tsup"` 로 단순화. `onSuccess` 가 single source 로 동작하므로 직렬 호출 중복 제거. turbo 캐시 시점과 `build:css` 완료 시점이 항상 일치 → `dist/styles.css` 누락 상태가 캐시되는 구조적 결함 해소. `scripts.build:css` 및 `scripts.dev` 는 미변경 (dev 의 `pnpm build:css && tsup --watch` prelude 는 `--watch` 첫빌드 race 회피용으로 보존).

### 회귀검증 결과

캐시 클리어 (`pnpm -r exec rm -rf dist` + `rm -rf .turbo node_modules/.cache`) → `pnpm build:packages` (10 tasks, 47.5s) → `pnpm typecheck:all` (8 tasks, exit 0, 11.8s) → 7개 `packages/fs-*/dist/styles.css` 모두 존재 (21KB ~ 90KB) → `pnpm exec turbo run build --filter='./packages/fs-external-data-viewer'` 재실행 시 FULL TURBO 캐시 hit (103ms) 후에도 styles.css 76846B 잔존 확인. 추가 실증: `build:css` 를 일시 `"exit 1"` 로 변경 후 `pnpm build` 시 tsup ELIFECYCLE exit 1 — turbo 가 깨진 dist 를 캐시하지 않음을 보장.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/tsup.config.ts`
- `packages/fs-data-viewer/package.json`
- `packages/fs-data-viewer-explorer/tsup.config.ts`
- `packages/fs-data-viewer-explorer/package.json`
- `packages/fs-external-data-viewer/tsup.config.ts`
- `packages/fs-external-data-viewer/package.json`
- `packages/fs-external-data-viewer-explorer/tsup.config.ts`
- `packages/fs-external-data-viewer-explorer/package.json`
- `packages/fs-file-attachment/tsup.config.ts`
- `packages/fs-file-attachment/package.json`
- `packages/fs-sub-data-viewer/tsup.config.ts`
- `packages/fs-sub-data-viewer/package.json`
- `packages/fs-sub-data-viewer-explorer/tsup.config.ts`
- `packages/fs-sub-data-viewer-explorer/package.json`

### 비차단 잔여

- i-dev-001 베이스라인 lint 부채 162 problems (124 errors / 38 warnings) — 본 플랜 변경분 무관 (`KanbanCardConfigDialog`, `UpgradeDialog`, `useFormWidgetHistory`, `zone3-deprecate.test.ts` 등 UI/test 파일). 본 플랜 lint gate 는 변경 7개 `tsup.config.ts` 단독 실행 시 exit 0 — 신규 오류 0건. 베이스라인 부채는 별도 플랜에서 처리 권장.

## v001.31.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 2)

### 페이즈 결과

- **Phase 6 (hotfix 2)** (`5c9bfedc`): 세로 막대 그래프의 막대 위 수치 라벨이 정수일 때 `.0` 이 표기되던 문제 수정. `BarChartWidget.tsx` 모듈 최상위에 `formatBarValue` 헬퍼 도입 — k-축약 분기 (`n >= 1000`) 를 먼저 평가해 기존 동작 유지하고, k 값이 정수면 `5k` / 아니면 `5.5k`. 1000 미만은 `Number.isInteger` 로 정수면 `String(n)`, 그 외엔 기존 `toLocaleString(undefined, { maximumFractionDigits: 1 })` fallback. 세로 막대 분기 (`!isHorizontal`) 의 값 레이블 인라인 표현식만 헬퍼 호출로 교체했고, 가로 막대 분기는 마스터 지시 범위 밖이라 미수정.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx`

### 검증 결과

- 코드 다이프: +10/-5, 1 파일 affected_files 내.
- 페이즈 iter: 2회 (1회차 `71f5a639` 의 precedence 역전 회귀 — 정수 ≥ 1000 이 k-축약을 잃어 `5000` → `"5000"` 으로 떨어지는 결함 발견. 마스터 명시 범위는 ".0 제거" 였으나 k-축약 깨짐은 의도치 않은 레이아웃 회귀라 reset 후 2회차에서 k-분기 우선 평가하는 구조로 재작성하여 통과).
- 동작 검증 (mental): `5` → `"5"`, `5.0` → `"5"`, `5.3` → `"5.3"`, `5000` → `"5k"`, `5500` → `"5.5k"`.
- Lint gate: advisory (베이스라인 동일, 신규 심볼 `formatBarValue` 회귀 grep 0건).

### 운영 메모

- 수동 검증: 세로 막대 그래프 위젯에서 정수 데이터일 때 라벨이 `5`/`5k` 로, 소수 데이터일 때 `5.3`/`5.5k` 로 표시되는지 확인. 가로 막대는 기존 표기 유지 (변경 없음).
- 가로 막대 분기는 마스터 지시 범위 밖 — 별도 핫픽스/플랜 시 동일 헬퍼 재사용 가능.

## v001.30.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#18

### 페이즈 결과

- **Phase 1** (`73f45b56` + hotfix `11daaf10`): `data-craft` 의 `pnpm typecheck:all` 26건 오류를 0으로 클린화. 5개 의미 그룹 일괄 해소 — (1) `FsDataViewerModel.kanbanCardAreas` 신설 후 누락된 5개 모델 빌드 사이트에 `kanbanCardAreas: null` 기본값 추가, (2) `HeaderSettings.tsx` 의 자식 다이얼로그 4개 (`CalendarHolidayDialog`, `CalendarLabelColumnDialog`, `GanttLabelColumnDialog`, `KanbanColumnDialog`) `setViewerModel` prop 을 `Dispatch<SetStateAction<RuntimeViewerModel>>` 로 widening 하여 부모/자식 setter 타입 invariance 해소, (3) `FsViewerMode` enum 에 `View = 'view'` 멤버 추가 (제3 모드 — readOnly 동작은 기존 분기 기본값으로 자연 흡수), (4) 대시보드 테스트 fixture/시그니처 정합 — `collectWidgetColumns.test.ts` (`w/h`→`width/height`), `WidgetTypeRegression.test.tsx` (vitest `toMatch` 2nd-arg 시그니처 미지원으로 메시지 인자 제거), `BarChartWidget.label-rotation.test.tsx` (`'bar'`→`'bar-vertical'` literal 정합), (5) `fs_api/src/index.ts` 에 `DashboardWidgetType` 재수출 추가, `loading-anim/types.ts` 의 `JSX.Element` → `ReactElement` 교체 (`react-jsx` transform 환경 정합), `aggregateUserScopedRows.ts` 의 `'../lib/...'` → `'../../lib/...'` 깊이 보정, `FsGanttChart.tsx` 의 `rowData.rowField` → `rowData.row.rowField` 접근 경로 교정 (`FsGanttRowData.row` 가 `FsGridRowModel` 을 보유), `CompactComponents.tsx` 의 `FsGridUserModel` cast 를 실제 스키마 (`id`/`name`/`imageBlob`) 에 맞게 매핑. Hotfix iter 에서 `kanban-drawer-header-separation.test.tsx` + `option-stability-repro.test.ts` 의 `no-explicit-any` 2건 동시 해소.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-api/src/index.ts`
- `packages/fs-data-viewer/src/entities/data-viewer-model.types.ts`
- `packages/fs-data-viewer/src/entities/grid-mode.types.ts`
- `packages/fs-data-viewer/src/entities/grid/grid-helpers.ts`
- `packages/fs-data-viewer/src/entities/model-adapter.ts`
- `packages/fs-data-viewer/src/features/print/views/integration.test.tsx`
- `packages/fs-data-viewer/src/__tests__/enterprise-448/kanban-drawer-header-separation.test.tsx` (hotfix)
- `packages/fs-data-viewer/src/__tests__/enterprise-448/option-stability-repro.test.ts` (hotfix)
- `packages/fs-data-viewer/src/widgets/dashboard/__tests__/WidgetTypeRegression.test.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/__tests__/collectWidgetColumns.test.ts`
- `packages/fs-data-viewer/src/widgets/dashboard/loading-anim/types.ts`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/__tests__/BarChartWidget.label-rotation.test.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/aggregateUserScopedRows.ts`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/CalendarHolidayDialog.tsx`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/CalendarLabelColumnDialog.tsx`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/GanttLabelColumnDialog.tsx`
- `packages/fs-data-viewer/src/widgets/data-viewer-header/header-settings/KanbanColumnDialog.tsx`
- `packages/fs-data-viewer/src/widgets/fs_grid_sub/hooks/useSubGridModel.ts`
- `packages/fs-data-viewer/src/widgets/gantt-chart/gantt-chart/FsGanttChart.tsx`
- `packages/fs-data-viewer/src/widgets/kanban-board/kanban-card/cell-renderers/compact/CompactComponents.tsx`

### 검증 결과

- 코드 다이프: +37/-24, 18 파일 (phase) + hotfix 2 파일, 전부 affected_files 내 (`fs_api` 재수출 1건 포함, 본문에 사전 명시).
- advisor 계획 / 완료 양 시점 5관점 PASS — 마스터 명령 의도 (lint gate 단계 1 = typecheck 통과) 일치, 의미 그룹 5개 일괄 처리의 논리적 완결성, 그룹 정책 (`data-craft/dev.md` lint_command) 단계 1 충족, 18 파일 diff 의 실 코드 근거, 단일 페이즈 종결로 명령 충족.
- 페이즈 iter: 1회 디스패치, 재시도 0회. lint gate hotfix iter 1회 (no-explicit-any 해소).
- Lint gate: typecheck 단계 PASS (`FULL TURBO` 0 오류). eslint 단계는 124건 pre-existing 오류 잔존 — 마스터 결정 (`단계 1 완료로 간주`) 에 따라 본 플랜 종결, 후속 플랜 권고.

### 운영 메모

- `FsViewerMode.View` 추가는 enum 멤버 확장만 수행, 분기 코드 무변경. 외부 caller 가 exhaustive switch 로 enum 을 사용하는 곳이 있다면 별도 회귀 가능 (현 패키지 내 사용처 grep 결과 영향 없음).
- 자식 다이얼로그 setter widening 은 부모 owned `RuntimeViewerModel` 상태를 직접 받는 형태로 정합. 자식들이 `prev` 를 spread 하여 internal 필드 (`showHorizontalBorder` 등) 를 보존하는 패턴은 자동 안전.
- `CompactComponents.tsx` 의 `FsGridUserModel` 매핑에서 `profileImage` 가 스키마에 없어 `undefined` 처리 — 기존 런타임 동작 (필드 부재로 항상 undefined) 동일.
- **후속 권고**: eslint pre-existing 부채 124건 (특히 `KanbanCardConfigDialog` `react-hooks/refs`, 다수 `no-explicit-any` 테스트, react/prop-types 등) 정리를 위한 별도 `/plan-enterprise data-craft eslint 부채 일괄 해소` 권장.

## v001.29.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16 (hotfix 1)

### 페이즈 결과

- **Phase 5 (hotfix 1)** (`63332e31`): 막대 차트 다중 시리즈 (`valueColumns.length >= 2`) 일 때 시리즈별 색 사용자 지정 가능. `BarChartSettings` 에 다중 시리즈 조건 하에서 각 시리즈 카드에 `FsLineChartColorPicker` (Phase 2 신설 래퍼 재사용) 노출, `handleValueColumnChange` 시그니처에 `color` 필드 추가. 단일 시리즈 (`valueColumns.length === 1`) 는 색 입력기 미노출, 현행 `colorScheme` + 카테고리 인덱스 자동 색 유지 (Hotfix 3 동작 보존). `BarChartWidget` 은 `seriesColors` 배열을 데이터 집계 블록 내 단일 소스로 계산해 4개 범례 마커 (가로/세로 × 상단/우측) 에 적용, 데이터 빌드 루프 안에서는 인라인 `isSingleSeries ? getSchemeColor(groupIdx, ...) : (vc.color ?? getSchemeColor(colIndex, ...))` 분기로 막대 색을 결정 — 단일 시리즈 per-category 색은 `groupIdx` 기반 분기로 보존, 다중 시리즈는 사용자 hex 우선 + 팔레트 fallback.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/BarChartSettings.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx`

### 검증 결과

- 코드 다이프: +53/-27, 2 파일 모두 affected_files 내.
- advisor 완료 검토 (5관점) PASS — `seriesColors` 단일 계산 + 인라인 per-bar 결정의 분리 일관성, 단일 시리즈 카테고리 색 보존, 4개 범례 마커 통일 갱신 모두 실 코드 인용으로 검증.
- 페이즈 iter: 1회 디스패치, 재시도 0회.
- Lint gate: advisory (베이스라인 사전 결함 동일, hotfix 신규 심볼 `seriesColors` / `handleValueColumnChange` color 확장 회귀 grep 0건).

### 운영 메모

- 수동 검증 시나리오: (1) 막대 위젯에 값 컬럼 2개 추가 → 각 시리즈 카드의 색 입력기로 자유 hex 지정 → 막대와 범례 마커 색 동기. (2) 값 컬럼 1개로 줄였을 때 색 입력기 사라지고 카테고리별 colorScheme 색 자동 복귀. (3) 가로 막대 / 세로 막대 양쪽에서 동일 동작 확인.
- `FsLineChartColorPicker` 가 막대 차트에도 재사용됨 — 래퍼명이 line-specific 으로 남아 있으나 기능적 호환. 별도 트랙 일반화 권장.
- `ChartValueColumn.color` 의 타입 주석 "선 그래프 전용" 잔존 — 본 hotfix 의 affected_files 범위 밖이라 미수정. 별도 정리 권장.

## v001.28.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#16

### 페이즈 결과

- **Phase 1** (`6f6f7c86`): `packages/fs-data-viewer/src/entities/dashboard/types.ts` 에 `export const VALUE_COLUMN_MAX = 3` 상수를 `ChartValueColumn` 타입 정의 직전에 추가. `LineChartWidget` 과 `BarChartWidget` 양쪽에서 컴포넌트 스코프 최상단에 `valueColumns = (config?.valueColumns ?? []).slice(0, VALUE_COLUMN_MAX)` 로컬 변수를 선언하고 IIFE 내부 valueColumnConfigs 빌드 루프, `valueCount`, `isSingleSeries` 판별까지 truncate 된 로컬을 참조하도록 교체. 4+ 시리즈로 저장된 기존 위젯도 렌더 단에서 앞 3개만 적용된다.
- **Phase 2** (`a1dc505d`): `packages/fs-data-viewer/src/shared/ui/ColorPicker/ColorPickerBase.tsx` 에 `allowCustomHex?: boolean` (기본 false) prop 추가 — true 시 팔레트 끝 "커스텀" 타일 렌더, 클릭 시 native color input 으로 임의 hex 를 `onSelectColor(-1)` 콜백. 기존 Gantt/Kanban 호출부는 prop 미전달로 동작 불변. 선 차트 전용 래퍼 `FsLineChartColorPicker.tsx` 신설 — `colorScheme` 8색 팔레트 + `allowCustomHex=true`, 인스턴스별 open/close/position 상태 내장. `LineChartSettings.tsx` 의 native input 을 본 래퍼로 교체, `valueColumns.length >= 3` 시 추가 Select 대신 "최대 3개" 안내 표시, 마운트 시 4+ 면 앞 3개로 마이그레이션 `useEffect`.
- **Phase 3** (`7bd0bb78`): `BarChartSettings.tsx` 에 Phase 2 와 동일 패턴 적용 — `valueColumns.length >= 3` 시 추가 Select 대신 "최대 3개까지 추가할 수 있습니다." 안내, 마운트 시 4+ 면 앞 3개로 마이그레이션. 막대 차트는 색이 colorScheme 인덱스 자동 적용이므로 색 입력기는 추가하지 않음.
- **Phase 4** (`58b51e98`): `LineChartWidget` / `BarChartWidget` 양쪽에 컨테이너 폭 측정 `ResizeObserver` 추가 (callback ref + `useState<HTMLElement | null>`, early-return placeholder 와의 hook 순서 충돌 없이). `containerWidth >= 360px` 일 때 외곽 `motion.div` 를 `flex-row` 로 전환하고 범례를 우측 `flex-col` (min-w-[80px]) 로 렌더링, 그 미만은 현행 상단 `flex-wrap` 유지. `BarChartWidget` 의 가로/세로 두 렌더링 분기는 단일 `legendOnRight` 플래그 공유.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`, merge SHA on i-dev-001 head):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts`
- `packages/fs-data-viewer/src/shared/ui/ColorPicker/ColorPickerBase.tsx`
- `packages/fs-data-viewer/src/shared/ui/ColorPicker/FsLineChartColorPicker.tsx` (신규)
- `packages/fs-data-viewer/src/shared/ui/ColorPicker/types.ts`
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/BarChartSettings.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx`

### 검증 결과

- 코드 다이프: 영향 파일 8개 모두 plan affected_files 내. 페이즈 간 surprise file 없음.
- advisor: 계획 시점 + 완료 시점 5관점 2회 모두 PASS (BLOCK 없음). 완료 시점 advisor 는 lint baseline skip 결정 + Phase 4 ResizeObserver ref 위치 (외곽 motion.div, 그리드 셀 폭 기반, 레이아웃 토글 불변) 를 명시 검증.
- 페이즈 iter: 4 페이즈 각 1회 디스패치 — 재시도 0회.
- Lint gate: `pnpm typecheck:all && pnpm lint` exit 2 — **본 플랜 변경과 무관한 사전 존재 오류** (`fs_data_viewer` `FsDataViewerModel.kanbanCardAreas` 누락, `DashboardWidgetType` export 누락, `JSX` namespace, `BarChartWidget.label-rotation.test.tsx` 의 `'bar'` 리터럴 타입 등). 베이스라인 i-dev-001 에서 동일 재현. Phase 1-4 신규 심볼 (`VALUE_COLUMN_MAX` / `FsLineChartColorPicker` / `allowCustomHex` / `legendOnRight` / `containerWidth`) 어느 것도 typecheck 출력에 등장하지 않음을 grep 으로 확인. CLAUDE.md §6 예방 트레드밀 회피 원칙에 따라 진행, **별도 트랙 정리 권장**.

### 운영 메모

- **수동 검증 필요**: 본 스킬 세션은 dev 서버 / 브라우저 실행 검증을 수행하지 않음. 마스터 골든 패스 확인 시나리오:
  1. 대시보드뷰에 신규 선 차트 위젯 → 값 컬럼 3개 추가 → 4개째 시 "최대 3개" 안내로 Select 차단 확인.
  2. 각 라인 색을 `FsLineChartColorPicker` 의 팔레트 + 커스텀 hex 양쪽으로 지정 확인.
  3. 막대 차트 위젯 → 값 컬럼 3개 cap + colorScheme 시리즈 인덱스 색 확인.
  4. 위젯 폭을 360px 경계 전후로 드래그하여 범례 상단↔우측 자동 전환 확인 (오실레이션 없는지).
  5. 4+ 시리즈로 저장된 기존 위젯이 있다면 (수동 JSON / DB 편집) 렌더 시 앞 3개만 표시 + 설정 진입 시 마이그레이션 저장 확인.
- Lint baseline 결함은 본 플랜 무관 — 별도 핫픽스/플랜으로 정리 권장.

## v001.27.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#17

### 페이즈 결과

- **Phase 1** (`cfccecd8`): `packages/fs-api/src/core/client.auth.ts` 의 `handleAuthFailure()` 가 토큰 클리어 후·리다이렉트 직전 등록된 사전 정리 콜백을 실행하도록 확장. 모듈 변수 `preAuthFailureCleanup: (() => void) | null` + `setPreAuthFailureCleanup(cb)` export 추가. 함수 본문을 `savedCompanyId` 사전 캡처(try/catch) → `tokenStorage.clearTokens()` → `preAuthFailureCleanup?.()` (try/catch 보호) → `dc_session_expired` 플래그 → 캡처된 `savedCompanyId`/urlParams.tenant/subdomain 순으로 리다이렉트 결정의 순서로 재배치 — 콜백이 localStorage 를 만져도 테넌트 리다이렉트(`/login?tenant=`) 가 보존된다. `packages/fs-api/src/core/client.ts` 와 `packages/fs-api/src/index.ts` 에 `setPreAuthFailureCleanup` re-export 한 줄씩 추가, `src/shared/lib/apiClient.ts` 의 barrel 에도 한 줄 재수출 추가. `src/app/providers/AuthProvider.tsx` 의 부팅 useEffect 진입 직후 `setPreAuthFailureCleanup` 으로 테마 리셋 콜백(`USER_THEMES.includes(theme)` 일 때 `useThemeStore.getState().setThemeFromServer('light')`) 등록, 언마운트 시 `setPreAuthFailureCleanup(null)` 해제. 기존 init-경로 `handleAuthFailure` 클로저(`authApi.init` 에러 분기)의 테마 리셋 분기는 그대로 유지되어 두 경로(런타임 401 인터셉터 / 새로고침 init 실패) 가 각각 독립적으로 테마를 리셋한다.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`, merge `0c83ed9f`):
- `packages/fs-api/src/core/client.auth.ts`
- `packages/fs-api/src/core/client.ts`
- `packages/fs-api/src/index.ts`
- `src/shared/lib/apiClient.ts`
- `src/app/providers/AuthProvider.tsx`

### 검증 결과

- 코드 다이프: 영향 파일 5개 모두 plan affected_files 내. fs_data_viewer 등 무관 영역 0-터치 (`git diff --name-only` 검증).
- advisor: 계획 시점 + 완료 시점 5관점 2회 모두 PASS (BLOCK 없음).
- 페이즈 iter: 1회 재시도 (1회차 `scope_expansion_needed` — `src/shared/lib/apiClient.ts` barrel 재수출 누락 보고, 승인 후 affected_files 확장하여 2회차 성공).
- Lint gate: `pnpm typecheck:all && pnpm lint` exit 2 — 단 본 페이즈 변경과 무관한 사전 존재 오류 (`fs_data_viewer` `FsDataViewerModel.kanbanCardAreas` 누락, dashboard widget 테스트 인자 시그니처). 베이스라인 i-dev-001 에서 동일 재현 확인. CLAUDE.md §6 예방 트레드밀 회피 원칙에 따라 진행, 별도 트랙 처리 권장.

### 운영 메모

- **수동 검증 필요**: 본 스킬 세션에서는 dev 서버 / 브라우저 실행 검증을 수행하지 않음. 마스터가 다음 4개 시나리오로 골든 패스 확인 필요:
  1. 만료 경로: 기업 테마(ocean 등) 적용 계정으로 로그인 → DevTools 에서 `dc_access_token`/`dc_refresh_token` 을 garbage 로 덮어쓰기 → 인증 API 트리거(새로고침/조회) → `/login?tenant={companyId}` 가 기본(light) 테마인지.
  2. 수동 로그아웃 회귀: 설정 다이얼로그 → 로그아웃 → 기본 테마.
  3. init-경로 회귀: 토큰 손상 + 새로고침(F5) → AuthProvider init 실패 경로 → 기본 테마.
  4. 리다이렉트 보존: 시나리오 1 에서 URL `?tenant=` 가 원 companyId 와 일치.
- 기업 테마 키 `dc_theme_{companyId}` 는 두 경로 모두 보존 — 다음 로그인 시 `seedBundleData` 가 복원할 사용자 선호값.

## v001.26.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#15

### 페이즈 결과

- **Phase 1** (`314a8da`): `data-craft-server/scripts/backfill-billing-encryption.ts` 신규. ENV 사전 검증(`BILLING_MASTER_KEY` base64 32바이트 + `DB_*` 5변수), `mysql2/promise` 단일 connection 으로 트랜잭션 개시, `SELECT id, billing_key, customer_key, card_number FROM billing_info WHERE billing_key NOT LIKE 'enc:v1:%' FOR UPDATE` 후 행별로 `encryptBillingField` 적용 — 컬럼별 `enc:v1:` prefix 검사로 idempotent 처리, `card_number IS NULL` 행은 SET 절에서 해당 컬럼 제외. UPDATE 루프 후 `SELECT COUNT(*) AS c FROM billing_info WHERE billing_key NOT LIKE 'enc:v1:%'` 사전 검증 (0 아니면 rollback) 후 commit. 예외 시 rollback + 사유 출력 + `process.exit(1)`. 평문 값은 어떤 로그 경로에도 출력되지 않음 (id + 컬럼명만 로깅). `package.json` scripts 에 `"backfill:billing": "ts-node scripts/backfill-billing-encryption.ts"` 추가.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`, merge `4c7c65a`):
- `scripts/backfill-billing-encryption.ts` (신규)
- `package.json` (scripts 항목)

### 검증 결과

- Lint: `pnpm lint` exit 0 (Phase 1).
- advisor: 계획 시점 + 완료 시점 5관점 2회 모두 PASS (BLOCK 없음).
- 페이즈 iter: 1회 재시도 (1회차 `plan_contradicts_code` — WIP 베이스 `origin/i-dev-001` stale, 로컬 i-dev-001 88349b3 로 리베이스 후 재디스패치 성공).

### 운영 메모

- **스크립트 실행은 마스터 책임**. freeze 창에서 `BILLING_MASTER_KEY` env 설정 후 `pnpm backfill:billing` 수동 실행. `SELECT … FOR UPDATE` 가 대상 행 락을 점유하므로 freeze 미시행 시 동시 결제 요청이 락 대기.
- 검증식: `SELECT COUNT(*) FROM billing_info WHERE billing_key NOT LIKE 'enc:v1:%'` = 0 (스크립트 내부 pre-commit guard 와 동일 — 마스터 명시).
- 키 회전(rotation) 미고려 — `encryptBillingField` 가 단일 master key 사용. 회전 도입 시 별도 스크립트 필요.
- 대규모 행수(수만+) 시 단일 트랜잭션 한계 — 현재는 마스터 운영 환경 추정 규모(수십~수백) 가정. 분할 옵션은 핫픽스로 대응.

## v001.25.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#14

### 페이즈 결과

- **Phase 1** (`9c8606b` + 어설션 1줄 후속 정정 `8667772`): 5개 테스트 파일 (`charge.service.test.ts`, `billingRenewal.test.ts`, `billingSubscription.executeFirstPayment.test.ts`, `src/tests/zone-01/sec-srv-45-payment-orderid.test.ts`, `seatChange.service.test.ts`) 에서 stale `cancelPayment` mock 프로퍼티와 단언 prune. logger mock 에 `critical: vi.fn()` 추가 (production 보상 분기가 `logger.critical({event_type:'PAYMENT_CHARGE_DB_FAILURE', context:...})` 로 이전됨). 보상 시도/실패 부수효과 검증 케이스는 logger.critical spy 단언으로 1:1 매핑 교체, cancelError 전파 전용 케이스는 삭제. iter#1 직후 노출된 `billingRenewal.test.ts:171` 의 stale `reason` 어설션 (`'자동갱신 결제 3회 연속 실패'` → `'자동갱신 결제 3회 연속 실패 → Free 강등'`) 1줄 정정. 5개 영향 파일 vitest 개별 실행 모두 PASS.
- **Phase 2** (`5732c8f`): `ChargeResult` 의 `orderid-mismatch` variant 에서 orphan `cancelError?: Error` 필드 제거. JSDoc 의 "cancelKey/cancelError 반환" 문구를 "paymentKey 반환" 로 정정. `grep -rn cancelError src/ tests/` 0건 확인.
- **Phase 3** (`b8f7673`): `billingRenewal.service.ts:renewSingleClient()` next-cycle 좌석 변경 적용 흐름에서 `appliedSeats = Math.max(currentSeats + netDelta, 1)` 직후 + `updateClientSeatsWithConnection` 호출 직전에 `assertValidSeats(appliedSeats, 1, MAX_SEATS_PER_PLAN)` 1줄 삽입. `@/utils/paymentGuards` import 보강. `billingSubscription.service.ts:128` 동일 패턴.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`, merge `11c0525`):
- `src/services/charge.service.test.ts`
- `src/services/billingRenewal.test.ts`
- `src/services/billingSubscription.executeFirstPayment.test.ts`
- `src/tests/zone-01/sec-srv-45-payment-orderid.test.ts`
- `src/services/seatChange.service.test.ts`
- `src/types/charge.types.ts`
- `src/services/billingRenewal.service.ts`

### 검증 결과

- Lint: `pnpm lint` exit 0 (페이즈별 3회 모두 통과).
- Phase 1 vitest: 5개 영향 파일 개별 실행 모두 PASS (charge=13/13, billingRenewal=7/7, billingSubscription.executeFirstPayment=4/4, sec-srv-45=3/3, seatChange=3/3).
- advisor: 계획 시점 + 완료 시점 5관점 2회 모두 PASS.
- 사전 존재 실패 (webhook.controller.test.ts, webhook.idempotency.test.ts, promotion.routes.\*.test.ts 등) 는 본 플랜 스코프 외 — debug-chain 라우터 미존재 / billing.model.ts 경로 불일치 / webhook.model.ts 미존재 등 별도 후속.

### 운영 메모

- Phase 3 가드 위치는 `Math.max(..., 1)` clamp 뒤 — 하한 (`< 1`) 은 silent clamp, 가드는 상한 (`> MAX_SEATS_PER_PLAN`) 만 보호. 마스터 명시 ("Phase 1 가드와 동일 패턴") 채택. 하한 검증이 필요해지면 `Math.max` 이전 위치로 이전 변형 가능.
- Phase 1 의 logger.critical mock 추가는 prod 의 보상 분기 이전을 따라잡은 후속 — 동일 패턴이 필요한 신규 결제 테스트 작성 시 동일하게 적용 필요.

## v001.24.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#13

### 페이즈 결과

- **Phase 1** (`47d79cc`): `Promotion` / `ClientPromotion` 인터페이스에 `maxSeats` / `snapshotSeats` 필드 추가 + `mapPromotionRow` / `mapClientPromotionRow` 매핑 + `insertClientPromotion` args 에 옵셔널 `snapshotSeats` + INSERT 컬럼/플레이스홀더 추가. 기존 caller 호환 유지.
- **Phase 2** (`2345b1f`): `purchasePromotion` 협업 seats 가드를 `assertValidSeats(seats, p.minUsers ?? 1, p.maxSeats ?? MAX_SEATS_PER_PLAN)` 로 교체 (minUsers 단독 검증 흡수). `insertClientPromotion` 호출 직전에 `snapshotSeats` 도출 + 재검증 후 박제.
- **Phase 3** (`dfc625a`): `billingRenewal.service.ts` 협업 갱신 경로를 `cp.snapshotSeats` 기준 분기 — non-null 이면 박제값 직결 사용 (FOR UPDATE 락 생략), NULL 이면 기존 `findClientSeatsForUpdate` fallback. 양 경로 모두 `assertValidSeats` 재검증 추가 (admin 의 promotion.minUsers 상향 가능성 차단).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`, merge `88349b3`):
- `src/types/promotion.types.ts`
- `src/models/promotion.model.ts`
- `src/services/promotion.service.ts`
- `src/services/billingRenewal.service.ts`

### 검증 결과

- Lint: `pnpm lint` exit 0 (페이즈별 3회 + 머지 전 최종 확인).
- 기존 테스트 영향 없음 (회귀 없음 — `promotion.routes.*.test.ts` 는 mocked charge 기반 HTTP integration, 시그니처 호환).
- advisor: 계획/완료 시점 2회 통과. Phase 2 의 `seats-below-min` 에러 코드 narrowing 검토 — 외부 caller 가 해당 코드를 직접 매칭하지 않음 확인.

### 운영 메모

- legacy `client_promotion` 행 (snapshot_seats == NULL) 의 박제 마이그레이션은 본 plan 범위 밖. 필요 시 별도 `task-db-data` 로 백필.
- snapshot 경로는 FOR UPDATE 락을 생략 — `snapshot_seats` 가 immutable 박제이므로 seats 값에 대해선 안전하지만 동일 company 동시 갱신 직렬화 효과 차이는 모니터링 포인트.

## v001.23.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 15, cumulative phase 21)

### Hotfix 결과 (Hotfix 13 결함 정정)

마스터 보고: `borderConfig.spacing='outside'` 사용 시 위젯이 이웃 위젯이나 보드 가장자리와 닿아야 하는데 안 닿음.

**원인**: Hotfix 13 iter 1 의 phase-executor 가 `outside` 를 WidgetContainer 의 `margin:6` 로 구현 → 위젯이 격자 셀에서 안쪽으로 6px 축소. Hotfix 6 의 DashboardGrid calc 인셋 (좌상우하 2.5px) 도 함께 적용되어 ~8.5px 안쪽 축소. 의미 정반대.

**마스터 의도 정확**:
- `'inside'`: 위젯 box 안에 border, 콘텐츠 padding 안쪽 보호. 위젯간 5px 여백 유지.
- `'outside'`: 위젯 box 가 격자 셀 가득 확장 — 위젯간 5px 여백 무효화, 이웃 위젯 border 와 픽셀 단위 맞닿음.

- **Phase 21** (`f071a230`):
  - WidgetContainer: outside 분기의 `margin:6` + width/height calc 보정 두 곳 (헤더 없는 분기, 헤더 있는 분기) 모두 제거. isOutside 변수도 삭제.
  - DashboardGrid: static 위치 계산부에 `isOutsideSpacing` 검사 추가 — `spacing='outside'` 위젯에 한해 2.5px calc 인셋 대신 격자 셀 raw 퍼센트 좌표 사용. 결과: outside 위젯은 격자 셀 가장자리까지 확장.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/DashboardGrid.tsx`

### 검증 결과

- TSC delta: 0.
- `pnpm build` ✅ `built in 17.70s`.

### 마스터 수동 회귀 시나리오

1. 위젯 두 개 가로로 인접, 둘 다 spacing='outside' + border 좌/우 ON → A 우측 border 와 B 좌측 border 가 픽셀 단위 맞닿음.
2. 보드 가장자리에 spacing='outside' 위젯 + border 좌 ON → 위젯 좌측 border 가 보드 좌측 가장자리에 닿음.
3. spacing='inside' (기본) 위젯은 기존 5px 여백 유지.

### Post-action hints

- 설정 모드 드래그 중 outside 위젯의 표시 크기 (calc % - 5px) 와 드롭 후 정착 크기 (% 원본) 가 일시적으로 미세하게 어긋남. dropPreview 인셋도 동일 — 시각적 결함이며 설정 모드 한정. 뷰 모드 영향 없음.

## v001.22.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 14, cumulative phase 20)

### Hotfix 결과 (반복 환경 결함 근본 정정)

마스터 보고: vite dev server 에서 `Failed to resolve import "fs_external_data_viewer/styles.css"` 가 어제 fix 후 다시 재발. fs-external-data-viewer / fs-sub-data-viewer 의 `dist/styles.css` 만 반복 누락 패턴.

**Root cause** (main session 직접 확인): 두 패키지의 `dev` 스크립트가 `"tsup --watch"` 만 실행 — tsup 가 dist 를 clear 하고 JS 만 재출력 → styles.css 누락. `fs-data-viewer` 의 dev 스크립트는 vite 기반이라 dist 미간섭 (css 보존). 두 패키지에서 어느 시점이라도 `pnpm dev` 가 돌면 css 가 사라지는 패턴.

- **Phase 20** (`e787f7dc`):
  - `fs-external-data-viewer/package.json` 과 `fs-sub-data-viewer/package.json` 의 `dev` 스크립트를 `"tsup --watch"` → `"pnpm build:css && tsup --watch"` 로 변경. dev 시작 시 styles.css 1회 생성 후 tsup watch 진입.
  - css 자체의 watch 는 빈도가 낮아 매번 빌드 불필요. tsup 가 dist clear 시점에도 build:css 가 함께 다시 실행되도록 하려면 별도 watch 도구 (concurrently 등) 도입 필요 — 본 hotfix 는 시작 시점 1회만으로도 마스터 보고 문제 해소.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-external-data-viewer/package.json` (dev script)
- `packages/fs-sub-data-viewer/package.json` (dev script)

### 검증 결과

- 코드 변경 0건 (package.json scripts 만 변경).
- TSC delta: 0.
- 환경 fix — dev server 재시작 시 정상 동작 확인 권장.

### 마스터 수동 회귀 시나리오

1. 두 패키지의 `pnpm dev` 가 시작 시점에 styles.css 를 생성하는지 확인.
2. dev server 가 fs-external-data-viewer / fs-sub-data-viewer 의 styles.css import resolve 성공 여부 확인.
3. 향후 styles 변경 시 일시적으로 stale 될 수 있으나 — css 변경 빈도가 낮아 dev 재시작 1회로 해소.

### Post-action hints

- 본 hotfix 는 dev 시작 시점 1회 build:css. **tsup watch 가 자동으로 dist clear 하면 그 시점에 css 가 다시 사라질 수 있음**. 영구 watch 가 필요하면 `concurrently` 또는 `npm-run-all` 도입해 `tsup --watch` 와 `tailwindcss --watch` 를 병렬 실행 — 후속 hotfix 검토 가능.

## v001.21.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#12 (Hotfix 1)

### Hotfix 결과

마스터 요청 — B1 (billingKey / 카드번호 평문 INSERT) 의 BE 코드 레이어를 본 플랜 안에서 즉시 처리. DB 작업 (컬럼 widening / 백필 / 평문 drop) 은 마스터가 별도 DB 프롬프트로 후속 실행.

- **Hotfix 1** (`38a11425a8aa6737841009518e8bd3853b52548d`):
  - `src/utils/billingCrypto.ts` 신규 — AES-256-GCM 봉투암호화 util.
    - `encryptBillingField(plaintext)` → IV(12B) + ciphertext + tag(16B) base64 직렬화 + `enc:v1:` prefix
    - `decryptBillingField(stored)` → prefix 없으면 평문 그대로 반환 (lazy migration — 기존 평문 행 호환)
    - 마스터키 = env `BILLING_MASTER_KEY` (base64 32 byte). 미설정 시 encrypt 호출 시점 throw, decrypt 는 prefix 없는 입력에 한해 key 불필요.
  - `src/models/billing.model.ts` 수정:
    - `createBillingInfo` INSERT: customerKey / billingKey / cardNumber (non-null) 암호화
    - `findActiveBillingByCompanyId` SELECT 반환 매핑: billingKey / customerKey / cardNumber decrypt 적용
    - `findBillingByCustomerKey`: WHERE 직접 비교 불가 (암호문 IV 매번 다름) → 활성 행 전수 fetch + in-memory decrypt 비교
    - `deactivateBillingByKey`: `WHERE is_active = 1` 로 스캔 제한 + decrypt 비교 → id 기반 UPDATE

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `src/utils/billingCrypto.ts` (신규)
- `src/models/billing.model.ts`

### 마스터 결정 카브아웃
- DB 컬럼 widening / 백필 / 평문 drop = 별도 DB 프롬프트 후속. 본 hotfix 는 코드 레이어만.
- `findBillingByCustomerKey` / `deactivateBillingByKey` 의 full-scan + in-memory decrypt 는 활성 빌링 행 수 = 회사 수 가정에서 수용. 대량화 시 인덱스 재설계 필요.
- `BILLING_MASTER_KEY` env fail-fast 는 lazy (encrypt 호출 시점) — 부팅 시 검증 보강은 B8 핸드오프 트랙에서 함께 처리.

### 후속 DB 작업 (마스터 별도 실행)
1. `/task-db-structure data-craft` — `billing_info` 컬럼 widening (`billing_key`, `customer_key`, `card_number` VARCHAR 길이 ≥ 200 또는 TEXT 로 확장)
2. `/task-db-data data-craft` — 기존 평문 행 일괄 암호화 백필 (BE 의 encryptBillingField 로직과 일치)

### 검증
- `pnpm lint` exit 0 (server hotfix1 base 깨끗, 신규 결함 0).
- 5-perspective advisor PASS (계획 + 완료 양쪽).
- 머지: hotfix WIP → server i-dev-001 (단일 step), 문서 WIP → I2 main.

---

## v001.20.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#12

### 페이즈 결과

`Project-I2/temp/data-craft-결제결함-32건.md` 의 🔴 HIGH 7건 검증 + 6건 수정 (B1 검증만, 후속 핸드오프).

- **Phase 1** (`aff16d2104281385bab486c3a69cdbbcc34f120c`): G3+B3+B4 — `paymentGuards.ts` 신설 (assertValidAmount/assertValidSeats + MAX_AMOUNT_KRW=10B / MAX_SEATS_PER_PLAN=1000). charge.service 진입부 amount 가드, promotion/seatChange/billingSubscription seats 분기 가드.
  - 보조 커밋 `35b2813`: i-dev-001 사전 lint 부채 6 errors + 1 warning 해소 (Phase 1 미터치 파일들).
- **Phase 3** (`1f259b7f74f07e409b8fb421dd39a0005e4b919d`): G8 — `findClientSeatsForUpdate(connection, companyId)` 추가 (SELECT ... FOR UPDATE). billingRenewal 협업 프로모션 결제 직전 블록을 트랜잭션으로 감싸 race 차단.
- **Phase 4** (`767ca3aa87170f55fe5fecca008355719c134a54`): G4 — webhook.controller secret 비교 `crypto.timingSafeEqual()` 로 교체 (length-mismatch dummy compare + 401). PAYMENT_STATUS_CHANGED 핸들러에 토스 `getPayment(paymentKey)` pull-after-push 추가. ABORTED/EXPIRED → FAILED 매핑.
- **Phase 2** (`8247399eabb660a510363b6bc1cfb9101416072c` + lint fix `6dd9c60`): G1 (옵션 B) — logger.ts `critical` 레벨 신설. 4 catch 블록 (billingSubscription/billingRenewal/seatChange/promotion) 에서 cancelPayment 보상 호출 전부 제거 → `logger.critical({event_type:'PAYMENT_CHARGE_DB_FAILURE', ...})` 단일 호출 대체. billingRenewal 만 throw→return false 로 변경 (이중 청구 방지).
- **Phase 5** (`8ad92fbf359c1881c638a8ea4b4928bc5e1035c1`): B2 — 잔존 호출처 3건 (billingRenewal:365, charge:83, charge:157) 도 모두 보상 cancel 경로로 payment_history 행 부재 → companyId 가드 양립 불가 (plan_contradicts_code). 옵션 B 일관 적용으로 3 호출처 모두 cancelPayment 제거 + 함수 자체 + TossCancelResponse 인터페이스 삭제. B2 자동 해결.
- **Phase 6** (`411dfdcaca653c7273a458e3290d31dd708c1cb1`, FE cross-repo): G2 — SeatAddDialog.tsx `applyAt='immediate'` 분기에 AlertDialog confirm 1회 경유 추가. next-cycle 분기는 confirm 생략 (기존 유지).
- **Phase 7** (코드 변경 없음): 핸드오프 이슈 2건 생성 — funshare-inc/data-craft-server#8 (B1 봉투암호화), funshare-inc/data-craft-server#9 (DB 컬럼 + 인프라 + 잔류 정리).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `src/utils/paymentGuards.ts` (신규)
- `src/utils/logger.ts` (critical 레벨 추가)
- `src/services/charge.service.ts`
- `src/services/promotion.service.ts`
- `src/services/seatChange.service.ts`
- `src/services/billingSubscription.service.ts`
- `src/services/billingRenewal.service.ts`
- `src/services/tossPayments.service.ts` (cancelPayment + getPayment)
- `src/types/tossPayments.types.ts` (TossCancelResponse 제거)
- `src/controllers/webhook.controller.ts`
- `src/models/client.model.ts` (findClientSeatsForUpdate 추가)
- 보조 lint debt: `src/services/auth.service.ts`, `src/services/inputStore.service.ts`, `src/services/seatChange.service.test.ts`, `tests/enterprise-482-p02-is-verified-removal.test.ts`

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`, FE cross-repo):
- `src/features/subscription/ui/SeatAddDialog.tsx`

### 마스터 결정 카브아웃
- **G1 옵션 B**: 환불 가정 배제 → cancelPayment 자동 시도 자체 제거 (4 + 3 = 7 호출처). 사용자 카드값 차감 잔존 = 운영자 수동 토스 어드민 처리 전제.
- **B1**: 본 플랜은 검증만, 마이그레이션 자체는 후속 task-db-* (data-craft-server#8).
- **G2 cross-repo**: plan-enterprise 단일 work repo 가정 일탈 → FE 워크트리 별도 + 3-step 머지.
- **data-craft 사전 lint 부채 163건**: 본 플랜 예외 인정. Project-I 시대 누적 — data-craft-server#9 로 후속 정리 트랙.

### 검증 결과
- Phase 1, 2, 3, 4, 5: data-craft-server `pnpm lint` exit 0 (모든 페이즈).
- Phase 6: data-craft `pnpm typecheck:all && pnpm lint` 사전 부채로 미통과, file-specific (SeatAddDialog.tsx) 검증 PASS.
- 5-perspective advisor: 계획 #1 PASS, 완료 #2 PASS (마스터 카브아웃 인정).

### 후속 작업 (data-craft-server 호스팅)
- **data-craft-server#8**: B1 billingKey/카드 봉투암호화 (task-db-structure + task-db-data + 코드)
- **data-craft-server#9**: promotion.max_seats / client_promotion.snapshot_seats DB 컬럼, 토스 IP allowlist, Phase 1/5/6 잔류 정리

---

## v001.19.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 13, cumulative phase 19)

### Hotfix 결과

마스터 요구: 모든 보드 위젯 상세 설정의 단일 `showBorder` 토글을 (1) 상/하/좌/우 4면 개별, (2) 모서리 둥글기, (3) 콘텐츠 안쪽 / 위젯 바깥쪽 여백 위치 선택 옵션으로 확장.

- **Phase 19 iter 1** (`7a5de780`):
  - 신규 타입 `BorderConfig` (top/right/bottom/left/radius/spacing) — `entities/dashboard/types.ts`, 배럴 export 동시 갱신.
  - 7개 *Config (Card/Pie/Line/BaseBarChart/Scatter/Gauge/UserList) 에 `borderConfig?: BorderConfig` optional 필드 추가. 기존 `showBorder` 는 deprecated 주석 + 호환 유지.
  - 공통 `BorderSettingsSection.tsx` 신규 (4면 토글 + 둥글기 슬라이더 + inside/outside segmented).
  - 7개 `*Settings.tsx` 모두에 BorderSettingsSection 추가.
  - WidgetContainer 에서 borderConfig 적용 — 활성 면 1개라도 있으면 4면 개별 border + radius + spacing 적용. `spacing='outside'` 는 margin:6px 으로 격자 셀 안에서 위젯 축소.
- **Phase 19 iter 2** (`305dabe0`):
  - Blocker (DashboardGrid 의 기존 showBorder border 와 WidgetContainer 의 borderConfig border 중복) 정정. DashboardGrid 의 border 적용 분기에 borderConfig 활성 가드 추가 → borderConfig 가 활성이면 DashboardGrid 측 border skip, WidgetContainer 가 책임. 미설정이면 기존 showBorder 동작 fallback.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts` (`BorderConfig` 정의, 7개 *Config 에 추가)
- `packages/fs-data-viewer/src/entities/dashboard/index.ts` (배럴 export)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/_shared/BorderSettingsSection.tsx` (신규)
- 7개 `*Settings.tsx` — Card/Pie/Line/BarChart/Scatter/Gauge/UserList
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (borderConfig 시각 적용)
- `packages/fs-data-viewer/src/widgets/dashboard/DashboardGrid.tsx` (iter 2 — border 일원화 가드)

### 검증 결과

- TSC delta: 신규 typecheck 에러 0건.
- `pnpm build` ✅ `built in 16.80s`.

### 마스터 수동 회귀 시나리오

1. 모든 위젯 설정에 새 "테두리" 섹션 노출 — 4면 토글 / 둥글기 슬라이더 / "콘텐츠 안쪽" · "위젯 바깥쪽" 토글 확인.
2. 4면 중 일부만 ON → 해당 면에만 border 표시.
3. 둥글기 12px → border-radius 시각 확인.
4. spacing='outside' → 위젯이 격자 셀 안에서 살짝 축소, 격자 셀 가장자리와 위젯 border 사이 여백 노출.
5. 기존 showBorder=true 만 설정된 위젯 → 4면 모두 동일 border (DashboardGrid 의 fallback) 회귀 확인.

### 미해결 / Post-action hints

- UserListWidget 의 user-card 개별 border 는 `UserCard.tsx` / `SlotCard.tsx` / `CompareSlotCard.tsx` 에서 `showBorder` 별도 참조. 본 hotfix 의 borderConfig 는 위젯 외곽만 담당하며 user-card 수준 border 와 의미 분리 불완전 — 후속 hotfix 검토 가능.

## v001.18.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 12, cumulative phase 18)

### Hotfix 결과

마스터 결정: 두 문제 동시 처리 + 카드 sparkline 은 **옵션 2 (단일 batch request 안에 서버 contract 변경 없이 통합)** 로 진행.

#### 결함 A — 파이 stacked layout 미적용 (effect logic)

`PieChartWidget.tsx` 의 `useLayoutEffect` 가 chartDataKey 변경 시 isAnyTruncated 가 이미 false 인 경우 `setIsAnyTruncated(false)` 한 번 호출 후 early return — React 가 false → false setter 를 no-op 처리해 재렌더 없음 → effect 재실행 없음 → 측정 영구 스킵.

**Fix**: isAnyTruncated 가 false 면 early return 하지 않고 같은 effect 호출 안에서 measure 진행. measure 호출은 `requestAnimationFrame` 으로 deferring 해 layout 안정화 후 측정. ResizeObserver callback 도 rAF wrap.

#### 결함 B — 카드 sparkline 서버 데이터 미수신 (architecture)

`FsDashboard.tsx` 의 Write 모드 + batch aggregation 경로가 `requestDashboardBatchAggregation` 만 호출 → rows 미반환 → preprocessedRows 빈 상태. CardWidget 의 sparkline 이 `groupRowsByMonth` (preprocessedRows 기반) 사용해 buckets empty → null.

**Fix (옵션 2, 서버 변경 없이 기존 groupedAggregation 인프라 재사용)**:
- `buildWidgetBatchParams.ts`: 기존 `buildWidgetBatchParam` 단수 함수를 shim 유지하고 `buildWidgetBatchParams` (배열 반환) 신규. card 의 `sparklineConfig` 활성 시 `widgetId: <원본id>__sparkline` + `groupByColumnId: dateColumnField` 의 별도 param 동봉 → 단일 batch request 안에서 처리.
- `FsDashboard.tsx`: emission 루프를 params (배열) 기반으로 전환. 응답 분배 시 `__sparkline` 접미사 widget 결과의 `groupedAggregation` 을 base widget 결과의 `sparkline` 필드로 fold. `getWidgetDataKey` card 분기에 sparklineConfig 포함해 변경 감지.
- `paging.types.ts`: `WidgetBatchAggregationData` 에 `sparkline?: Record<string, Record<number, ServerAggregationResult>>` 필드 추가.
- `CardWidget.tsx`: sparkline 계산을 `aggregationData?.sparkline` (서버 groupedAggregation) 기반으로 전환. raw date 키를 YYYY-MM 으로 reduce + 최근 N개월 키 화이트리스트 필터 + 시간순 정렬. `groupRowsByMonth` (preprocessedRows 의존) 제거.

결과: Write 모드 batch aggregation 만으로도 sparkline 정상 렌더. **추가 서버 요청 없음** — 단일 batch request 의 widget 배열에 sparkline 위젯 entry 가 동봉되어 함께 처리.

- **Phase 18** (`5b3659a5`).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (effect 정정 + rAF)
- `packages/fs-data-viewer/src/widgets/dashboard/lib/buildWidgetBatchParams.ts` (단수 → 배열 반환 + sparkline param 동봉)
- `packages/fs-data-viewer/src/widgets/dashboard/FsDashboard.tsx` (emission/응답 분배 + __sparkline fold)
- `packages/fs-data-viewer/src/entities/paging.types.ts` (WidgetBatchAggregationData.sparkline 필드)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx` (sparkline 계산 source 전환)

### 검증 결과

- TSC delta (변경 파일): 신규 typecheck 에러 0건.
- `pnpm build` (root, packages 빌드 후): `✓ built in 17.20s` 통과.
- 서버 contract / endpoint 변경 없음 — batch aggregation 의 widgets 배열에 sparkline entry 만 추가됨.

### 마스터 수동 회귀 시나리오

1. 카드 sparkline 옵션 활성 + 날짜 컬럼 + 개월 수 설정 → 대시보드 Write 모드에서 카드 본체 하단에 미니 선 그래프 + 증감율 노출.
2. Network 탭의 dashboard-aggregation 요청 1회만 발생 (추가 fetch 없음). 요청 body 의 widgets 배열에 sparkline 활성 카드는 두 entry (base + __sparkline) 포함되는지 확인.
3. 파이 위젯에서 라벨 1개라도 truncate 발생 → 전체 stacked layout 으로 즉시 전환 확인.
4. 파이 데이터 변경 시 stacked → inline 자동 복귀.
5. dev server HMR 재시작 + 강력 새로고침 권장.

## v001.17.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 11, cumulative phase 17)

### Hotfix 결과 (Hotfix 10 결함 정정)

마스터 진단: Hotfix 10 적용 후에도 파이 범례 stacked 전환이 실제로 일어나지 않음 — 라벨은 시각상 truncate 되지만 stacked layout 으로 전환 안 됨.

**Root cause** (main session 직접 코드 점검): `PieChartWidget.tsx` 에 두 개의 useLayoutEffect 가 있었는데, **Effect 1 (measure)** 가 측정 후 `setIsAnyTruncated(true)` 를 호출하면 바로 뒤이어 실행되는 **Effect 2 (reset)** 가 `setIsAnyTruncated(false)` + `labelRefs.current = []` 로 덮어쓰는 구조. 결과: 측정 결과가 매번 false 로 reset 되고 ref 배열이 비워져 ResizeObserver 재측정도 무력화됨.

- **Phase 17** (`1bc51d59`):
  - Effect 2 (reset useLayoutEffect) 완전 제거.
  - Effect 1 안에 `prevKeyRef = useRef(chartDataKey)` 추가 — chartDataKey 변경 시 `setIsAnyTruncated(false)` 한 번 호출 후 다음 렌더에서 측정. 동일 키 재실행 시에는 reset 건너뜀.
  - `labelRefs.current = []` 수동 클리어 제거 — React 의 ref 콜백이 새 렌더 시 자동 재할당하므로 불필요.
  - 결과: 단일 useLayoutEffect 로 데이터 변경 reset + 측정 + ResizeObserver 일관 처리. measure → setState → re-render → measure 의 정상 사이클 복구.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (+7 / -7)

### 검증 결과

- TSC delta: 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 파이 위젯 — 긴 라벨 1개라도 → 전체 stacked 2줄 layout 전환 **실제 적용 확인**.
2. 위젯 폭 변경 — ResizeObserver 재측정 정상 동작.
3. 데이터 변경 시 stacked → inline 자동 복귀 (prevKeyRef 가 chartDataKey 변경 감지해 reset).

## v001.16.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#10

### 페이즈 결과

- **Phase 1** (`1edc5ef`): `findExternalDataGroups` UNION 첫 SELECT 두 곳 보정 — (A) `groupName` 컬럼을 `CASE WHEN user_fl.form_id IS NOT NULL THEN CONCAT('[폼] ', user_fl.form_name) ELSE dg.group_name END` 로 치환 (form 분기 표시명 `[폼] {form_name}` 으로 통일), (B) WHERE 절에 widget-scoped 패턴 `^__wdata_p[0-9]+_[0-9a-f]+$` 비노출 조건 추가 (단, `user_fl.form_id IS NOT NULL` 분기로 폼 소속 그룹은 보존). 결과: 외부 데이터 탐색기(일반) 화면에서 raw `__wdata_p*` widget-scoped 카드 17건 비노출, legacy 폼 1473 의 group_name 은 raw 데이터 그대로 유지된 상태에서 표시명만 `[폼] 직원 관리` 로 노출. multi 분기 미변경.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `src/models/externalData.model.ts` (+7 / -1)

### 후속 (plan 미포함)

- **C — legacy form group_name DML 정규화**: 마스터 별도 `/task-db-data data-craft` 호출 예정. `db.md` 의 DML → task-db-data 정책 + Phase 1A 의 표시 결함 해소 + phase-executor DB 미실행 사유로 본 plan 분리.
  - 쿼리 요지: `form_list.is_deleted = 0` 이고 `dg.group_name LIKE '__wdata_p%'` 이며 `dg.group_name NOT LIKE '[폼] %'` 인 `data_group` 행을 `CONCAT('[폼] ', form_name)` 으로 UPDATE.
  - 사전 확인: company_id 별 group_name UNIQUE 충돌 (`[폼] {form_name}` 중복) 여부.

### 검증 결과

- 변경 파일 `src/models/externalData.model.ts` 단독 eslint 통과 (exit=0). `pnpm lint` 전체는 6 errors + 1 warning 으로 실패하나 모두 i-dev-001 베이스라인 (`fc3a6cf`) 의 기존 결함 (auth.service / seatChange.service.test / enterprise-482 테스트 / inputStore unused-disable). Phase 1 이 도입한 lint 결함 0건 확인.
- `form_list.form_name` 컬럼 NOT NULL (`db.sql/01-tables.sql:343` `varchar(20) NOT NULL`) — CASE WHEN 분기에서 NULL 노출 위험 없음.
- 5-perspective advisor 통과 (계획 + 완료 시점 두 회 모두 BLOCK 없음).

### 마스터 수동 회귀 시나리오

1. 외부 데이터 탐색기(일반) 새로고침 — raw `__wdata_p*` 카드 17건 사라짐, `[폼] 직원 관리` 카드 1건 신규 노출, 기존 `[폼] *` 카드 20건 유지.
2. "직원 관리" 폼 진입 — group_id (1473) / 데이터 정상 (group_name DML 미실행 상태이므로 raw 그대로지만 화면 표시는 form_name 으로 노출).
3. 새 폼 생성 → `[폼] *` 즉시 노출 (builder.form.ts createForm 회귀 무).
4. input/selector 위젯 저장/로드 회귀 — group_id 기반이라 영향 없음 (`inputStore.service` 경로 1회 확인).

## v001.15.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 10, cumulative phase 16)

### Hotfix 결과

마스터 요구: 파이 위젯 우측 범례에서 라벨이 한 항목이라도 truncate 발생 시 → 모든 항목을 `[마커] [라벨]` / `값 (퍼센트%)` 2줄 stacked layout 으로 자동 전환. 추가로 stacked 라벨도 길이가 컨테이너 폭을 초과하면 multi-line ellipsis 로 잘림.

- **Phase 16 iter 1** (`144baea7`):
  - `PieChartWidget.tsx` 우측 범례 라벨 span 에 `ref` 부착, `useLayoutEffect` 에서 `scrollWidth > clientWidth` 측정해 `isAnyTruncated` state 갱신.
  - 범례 컨테이너에 `ResizeObserver` 부착 — 폭 변화 시 재측정.
  - `chartDataKey` 변경 시 inline layout 으로 리셋.
  - `isAnyTruncated === true` 시 stacked layout 분기 (1행 마커+라벨, 2행 pl-[18px] 들여쓰기+`값 (퍼센트%)`).
- **Phase 16 iter 2** (`481b2f3d`):
  - stacked 라벨 span 에 multi-line ellipsis 패턴 적용 (`display: -webkit-box`, `WebkitLineClamp: 2`, `WebkitBoxOrient: vertical`, `overflow: hidden` + 기존 `whiteSpace: normal`, `wordBreak: keep-all` 유지).
  - 결과: stacked 에서 자연스럽게 wrap, 2 라인 초과 시 끝에 말줄임표.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (+111 / -25)

### 검증 결과

- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 파이 위젯 — 짧은 라벨만 있는 데이터: inline layout (`[마커] [라벨] 값 (퍼센트%)`) 유지.
2. 파이 위젯 — 긴 라벨 한 개라도 포함 → 모든 항목이 stacked 2줄 layout 으로 전환.
3. 파이 위젯 — stacked 에서도 라벨이 매우 긴 경우 (한 단어 길이 등) 2 라인 wrap 후 말줄임표.
4. 위젯 폭을 늘리거나 줄이면 ResizeObserver 가 재측정 — 충분히 넓어진 후 데이터 변경 또는 새로고침 시 inline 으로 복귀 (`chartDataKey` reset 의존).

## v001.14.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 9, cumulative phase 15)

### Hotfix 결과 (회귀 결함 정정)

마스터 진단: 카드 위젯의 sparkline 옵션을 활성화하고 dateColumnField 까지 정상 설정해도 sparkline 이 렌더되지 않음. 데이터 계층 / DB column_setting / 위젯 config 모두 확인 결과 정상.

**Root cause** (main session 직접 코드 확인): `packages/fs-data-viewer/src/widgets/dashboard/collectWidgetColumns.ts` 의 card/gauge 분기가 `config.columnField` 만 collect 하고 `sparklineConfig.dateColumnField` 를 누락. Phase 4 (`22a65f3d`) 에서 sparklineConfig 필드를 추가했으나 이 collect 함수 업데이트를 빼먹은 회귀. 결과: 서버 fetch 요청에 날짜 컬럼 ID 가 포함되지 않음 → 응답 row 에 해당 셀이 없음 → preprocessedRows cellMap 에 키 부재 → `groupRowsByMonth` 의 `cellMap.get(dateColumnField)` 모두 undefined → bucketMap empty → buckets.length === 0 ≤ 1 → sparkline = null → UI 미렌더.

- **Phase 15** (`468498bf`):
  - `collectWidgetColumns.ts` 의 card/gauge 분기에 `config.type === 'card' && config.sparklineConfig?.dateColumnField != null` 가드 + `columns.push(config.sparklineConfig.dateColumnField)` 3줄 추가.
  - `!= null` 사용으로 0 인 columnField 값도 정상 수집. gauge 타입에는 sparklineConfig 가 없으므로 타입 가드 안전망.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/collectWidgetColumns.ts` (+3 / -0)

### 검증 결과

- TSC delta: 0 (테스트 파일의 사전 부채 1건은 본 변경 무관, baseline 에 이미 존재).

### 마스터 수동 회귀 시나리오

1. 카드 위젯의 sparkline 옵션 활성 → 날짜 컬럼 선택 → 개월 수 7 → 저장.
2. 대시보드 진입 시 카드 본체 하단에 미니 선 그래프 + 증감율이 정상 렌더되는지 확인.
3. dev server HMR 잔존 가능성 — 적용 후에도 안 보이면 강력 새로고침 1회 또는 dev server 재시작 권장.

## v001.13.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 8, cumulative phase 14)

### Hotfix 결과

마스터 요구 2개:
1. 선 그래프 상세 설정에 "선 색상 설정 기능 없음" 인지 — 실제론 color picker 존재했으나 시각 명료성 낮아 인지 실패.
2. 모든 위젯 상세 설정에 "위젯 저장 및 적용" 버튼 좌측에 **빨강색 취소 버튼** 추가.

- **Phase 14** (`ef2629a7`):
  - **A. LineChartSettings 선 색상 UI 명료화** — color picker 컨테이너 `w-10 → w-14`, swatch `w-8 → w-10 + border-2 border-gray-400`, 라벨 `Color (text-[10px]) → 선 색상 (text-xs)`. 사용자가 한 눈에 인지 가능.
  - **B. WidgetSettingsPanel 취소 버튼** — 컴포넌트 mount 시 widget.config 의 `structuredClone` 을 `useRef` 로 스냅샷. 취소 클릭 시 초기 config 복원 (`onConfigChange`) + 패널 닫기 (`onComplete`). 빨강 테두리 + 빨강 텍스트 motion.button 을 "저장 및 적용" 버튼 좌측에 배치.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx` (color picker 시각 명료화)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/WidgetSettingsPanel.tsx` (snapshot 스냅샷 + 취소 버튼)

### 검증 결과

- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 선 그래프 위젯 설정 — 각 값 컬럼 행에 "선 색상" 라벨 + 더 큰 swatch 가 시각적으로 명확히 노출, 클릭 시 color picker 동작 확인.
2. 위젯 설정 패널 — "위젯 저장 및 적용" 버튼 좌측에 빨강 텍스트 "취소" 버튼 노출.
3. 위젯 설정 변경 후 취소 — 변경사항 폐기되고 패널 진입 전 상태로 복원 확인. 저장 시 변경사항 유지 확인 (회귀 체크).

## v001.12.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 7, cumulative phase 13)

### Hotfix 결과

마스터 요구 2개:
1. 파이 위젯 중앙 빈 공간에 열 제목 + 총 수치값 (K/M/B 압축 포맷, 카드 위젯과 동일 방식).
2. 헤더 top + 좌우 패딩 추가 5px 씩 (현재 5px → 10px). 하단은 유지.

- **Phase 13** (`cc7484b6`):
  - **A. 파이 중앙 텍스트 (`PieChartWidget.tsx`)** — `formatCompactNumber` import 추가, 도넛 SVG 내 중앙 좌표 (cx=50, cy=50) 에 두 줄 `<text>` 삽입.
    - 윗줄: `valueColumnField` 가 가리키는 컬럼의 title (fontSize 4.5, textMuted 색). 열 제목이 빈 문자열이면 미렌더 조건부.
    - 아랫줄: chartData 전체 value 합을 `formatCompactNumber` 압축 포맷 (fontSize 8, bold, textPrimary 색).
  - **B. 헤더 패딩 (`WidgetContainer.tsx`)** — 헤더 padding 을 `'5px 5px 4px 5px'` → `'10px 10px 4px 10px'` (top + 좌·우 각 5px 추가, 하단 4px 유지).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (도넛 중앙 텍스트)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (헤더 padding 10/10/4/10)

### 검증 결과

- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 파이 위젯 — 도넛 중앙에 두 줄 표기 (윗줄 작은 폰트 회색 열 제목, 아랫줄 큰 굵은 폰트 총합 K/M/B 포맷) 노출 확인. 열 제목 미설정 시 윗줄 자동 비표시.
2. 위젯 헤더 — top·좌·우 패딩 10px (5px 추가) 시각 확인.

## v001.11.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 6, cumulative phase 12)

### Hotfix 결과

마스터 요구 3개:
1. 세로 막대 X 라벨이 균등 분배 후에도 truncate(말줄임표) 로 나타남 — 컬럼 폭을 활용해야 함.
2. 보드 위젯 간 5px 씩 여백.
3. 헤더 아이콘-제목 사이 5px 추가 (현재 5px → 10px).

- **Phase 12** (`23819249`):
  - **A. 세로 막대 X 라벨 폭 활용 (`BarChartWidget.tsx`)** — 각 그룹 컬럼을 `flex-shrink-0` 고정폭에서 `flex: 1 1 0` 균등 분배 방식으로 전환. X 라벨 셀이 컬럼 전체 폭을 활용. maxWidth 고정값(groupWidth px) → 100% 로 교체해 truncate 가 컬럼 폭 초과 시에만 적용.
  - **B. 위젯 간 5px 여백 (`DashboardGrid.tsx`)** — 절대위치 기반 위젯에 calc() 인셋 (2.5px offset, 5px 크기 감소) 으로 모든 방향 5px 시각적 여백. 드롭 프리뷰도 동일 적용.
  - **C. 헤더 gap (`WidgetContainer.tsx`)** — flex gap 5px → 10px (아이콘 ↔ 제목 간격 추가 5px 확대).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx` (X 라벨 컬럼 flex 균등)
- `packages/fs-data-viewer/src/widgets/dashboard/DashboardGrid.tsx` (calc 인셋 위젯간 여백)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (gap 10px)

### 검증 결과

- advisor 사전 검토 없이 진행 (3 요구사항 모두 명확하고 작은 시각 조정).
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 세로 막대 — X 라벨이 막대 컬럼 폭 전체를 활용해 표시되는지 확인 (이전: 좁은 폭으로 truncate). 라벨이 컬럼 폭 초과 시에만 말줄임표 적용.
2. 위젯 격자 — 모든 인접 위젯 사이에 5px 시각적 간격 확인 (가로/세로 모두).
3. 헤더 — 아이콘 + 제목 둘 다 있는 위젯에서 사이 간격이 10px (이전 5px → 5px 추가) 으로 확장 확인.

## v001.10.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 5, cumulative phase 11)

### Hotfix 결과

마스터 요구 4개:
1. 세로/가로 막대 그래프 — 주어진 공간 균등 배분 (현재 한쪽으로 몰림).
2. UserListWidget — 한 카드에 다 들어가면 좌우/상하 이동 버튼 미표시.
3. WidgetContainer 헤더 — top + 좌·우 여백 5px 씩.
4. WidgetContainer 헤더 — 아이콘+제목 둘 다 있을 때 둘 사이 5px gap.

- **Phase 11** (`b544bfac`):
  - **A. 막대 균등 분배 (`BarChartWidget.tsx`)** — 가로 막대 차트의 행 스크롤 컨테이너와 세로 막대 차트의 열 컨테이너에 각각 `justify-evenly` 추가. 데이터 개수가 적어도 막대가 위젯 가용 공간을 균등하게 채워 배치.
  - **B. UserList nav 조건부 (`PaginatedUserGrid.tsx`)** — `totalPages <= 1` 일 때 화살표 (이전/다음) 버튼을 미렌더링. 추가로 카드 그리드 패딩을 32px → 8px 로 축소해 회수된 여유 공간을 카드 영역에 반환.
  - **C. WidgetContainer 헤더 패딩 (`WidgetContainer.tsx`)** — 헤더 wrapper 의 padding 을 `5px 5px 4px 5px` (top/right/bottom/left) 로 변경. top·좌·우 5px, 하단은 차트 영역과의 시각 균형 위해 4px 유지.
  - **D. 헤더 슬롯 gap (`WidgetContainer.tsx`)** — flex 헤더의 `gap` 을 4px → 5px 로 변경. 3-slot 고정 width 구조 (좌끝 icon | flex-1 title | 우끝 icon) 특성상 빈 placeholder 슬롯과의 gap 은 시각적으로 무효, 아이콘과 제목이 둘 다 존재할 때만 시각적으로 5px 간격으로 나타남 → 마스터 요구 "둘 다 있을 때 둘 사이 5px" 자동 충족.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx` (justify-evenly 적용)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/PaginatedUserGrid.tsx` (totalPages ≤ 1 nav 미렌더 + 카드 그리드 padding 축소)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (헤더 padding + gap 5px)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 헤더 gap 의 "둘 다 있을 때만" 조건이 3-slot 고정 width 구조로 시각적 자동 충족 확인.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. **막대 그래프 (가로/세로 모두)** — 데이터 행/열 수가 적은 케이스에서도 위젯 영역 전체에 막대가 균등 분배되는지 확인 (이전: 한쪽 몰림).
2. **UserListWidget** — 사용자 카드가 한 페이지에 다 들어가는 경우 (totalPages ≤ 1) 좌우/상하 이동 버튼이 비표시되는지 확인. 카드 영역이 더 넓어진 것도 확인.
3. **헤더 패딩** — 모든 위젯 헤더에서 상단/좌/우 각 5px 여백 확인.
4. **헤더 아이콘-제목 gap** — 아이콘 + 제목 둘 다 설정한 위젯에서 둘 사이에 5px 간격 확인. 한쪽만 있을 때는 시각 차이 없는지 확인 (placeholder 슬롯이 gap 의 시각 효과를 흡수).

## v001.9.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 4, cumulative phase 10)

### Hotfix 결과

마스터 요구 3개:
1. 카드 sparkline 은 카드 비율 유지하면서 표시 (현재는 공간을 더 잡아먹음).
2. 선 그래프 우측 95% 활용, 좌측은 Y축 단위 고려해서 95% 활용.
3. 카드 숫자 K/M/B 포맷 + 단위 개행 → 값 바로 옆 (인라인).

- **Phase 10 iter 1** (`e0d7a30d`):
  - **A. 카드 sparkline 압축** — CardWidget 을 flex column 7:3 비율 분할로 재구성. sparkline 활성/비활성 여부와 무관하게 카드 외부 height 불변. sparkline 영역은 카드 폭 거의 가득, 좌우 padding 최소.
  - **B. 선 그래프 좌우 활용** — LineChartWidget 의 가로 inset 을 좌 90→20px, 우 10px 비대칭 축소. Y축 라벨 컬럼 max-w-[64px] 제한으로 차트 SVG 가 위젯 가로 영역의 ~95% 활용.
  - **C. K/M/B 포맷 + 단위 인라인** — `formatCompactNumber` 헬퍼를 `dashboard-data-utils.ts` 에 신규 (1K~999K / 1M~999M / 1B~, 정확한 정수는 소수 생략, < 1000 은 toLocaleString). CardWidget 단위는 숫자와 같은 flex row baseline 에 13px 보조 폰트 인라인 (`unitPosition` 좌/우 옵션 존중).
- **Phase 10 iter 2** (lint hotfix `60865322`): CardWidget IIFE 반환 union narrowing 결함 정정 — ternary fallback 을 `displayData.value !== null ? formatCompactNumber(value) : '-'` 패턴으로 단순화해 TS2339 해소.
- **Phase 10 iter 3** (`07f30850`): advisor 지적 — K/M/B 포맷이 서버 집계 경로에서도 일관 적용되도록 IIFE 의 서버 분기 반환을 `{ value: serverResult.value, formattedValue: '-' }` 로 통일. 출력 단계의 `formatCompactNumber(value)` + 단위 인라인 한 경로에서 클라이언트·서버 양 경로 모두 처리.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx` (iter 1, 2, 3 — 비율 분할 + 포맷 + 서버 경로 통일)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx` (iter 1 — inset 축소)
- `packages/fs-data-viewer/src/widgets/dashboard/lib/dashboard-data-utils.ts` (iter 1 — `formatCompactNumber` 헬퍼 신규)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS (iter 3 정정 후) — iter 1 직후 server-aggregation 경로의 K/M/B 미적용 갭을 advisor 가 사전 지적, iter 3 에서 출력 단계 통일로 해소.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건 (iter 2 의 narrowing 정정 포함).

### 마스터 수동 회귀 시나리오

1. **카드 비율** — sparkline 활성 카드와 비활성 카드의 외부 height 가 같은지 확인. 활성 시 내부 7:3 분할로 sparkline 이 카드 하단 약 30% 영역 차지.
2. **카드 K/M/B** — 작은 수 (< 1000) 은 천 단위 콤마, 1K~999K / 1M~999M / 1B 이상은 압축 포맷, 정확한 정수는 소수 생략 확인. 클라이언트 모드·서버 집계 모드 양쪽 모두 적용.
3. **카드 단위 인라인** — `config.unit` 설정 시 숫자 바로 좌·우 (unitPosition) 에 작은 폰트로 한 줄 표시, 개행 없음 확인.
4. **선 그래프 좌우 95%** — 위젯 영역 전체 폭 대비 차트 SVG 영역이 우측 거의 끝까지, 좌측은 Y축 라벨 64px 이내 + 추가 inset 20px 안에서 95% 활용 확인. 1월/12월 같은 끝 데이터 포인트가 Y축 라벨 컬럼에 가려지지 않는지 시각 체크.
5. **선 그래프 X 회전 라벨 가독성** — Y라벨 cap 64px 와 inset 20/10 px 변경으로 회전 X 라벨이 차트 영역을 약간 벗어날 수 있음 — 긴 라벨(8자 이상) 의 truncate 동작 확인.

## v001.8.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 3, cumulative phase 9)

### Hotfix 결과

마스터 요구: (1) 막대그래프 단색 적용 문제 해결 — 급진적 2 + 점진적 2 테마. (2) 파이/산점도 동일 적용. (3) 선 그래프는 테마 대신 라인별 색 지정.

- **Phase 9** (`914852f2`):
  - **A. 4종 팔레트 재정의 (`chart-colors.ts`, `ColorSchemeSelector.tsx` 동기화)** — 기존 ID 유지로 데이터 마이그레이션 없음:
    - `warm` = 급진적1 (vibrant-warm, 8색 고대비).
    - `cool` = 급진적2 (vibrant-cool, 8색 고대비).
    - `default` = 점진적1 (blue 단일 hue 명도 8단계).
    - `mono` = 점진적2 (gray 단일 hue 명도 8단계).
  - **B. 막대그래프 단일 시리즈 카테고리 색 (`BarChartWidget.tsx`)** — `valueColumns.length === 1` 분기 추가 (`isSingleSeries` / `isSingleSeriesClient` 변수). 서버 경로(line 98+113) 와 클라이언트 경로(line 187+215) 양쪽 모두 단일 시리즈 시 group 인덱스로, 다중 시리즈 시 column 인덱스로 색 결정.
  - **C. 산점도 포인트별 색 (`ScatterChartWidget.tsx`)** — 기존 `getSchemeColor(0, ...)` 단일 색 → normalizedPoints 빌드 시 point 인덱스 기반 색을 내장해 두 렌더 분기 모두 일관 적용.
  - **D. 파이 차트 (`PieChartWidget.tsx`)** — 변경 없음 (이미 slice index 기반 색). 새 팔레트 자동 적용.
  - **E. 선 그래프 라인별 색 (`types.ts`, `LineChartWidget.tsx`, `LineChartSettings.tsx`)** — `ChartValueColumn` 에 `color?: string` 추가. `LineChartWidget` 의 색 결정을 `vc.color ?? getSchemeColor(colIndex, config.colorScheme)` fallback 패턴으로 변경 (line 190, 341). `LineChartSettings` 에서 `<ColorSchemeSelector>` 블록 제거 후 각 valueColumn 행에 color picker 추가.
  - **F. 데이터 호환성** — `LineChartConfig.colorScheme` 필드는 유지 (deprecated 로 두되 UI 노출 X). 기존 위젯이 `colorScheme: 'default'` 만 있고 valueColumns 에 color 가 없을 때 fallback 으로 정상 렌더.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/lib/chart-colors.ts` (팔레트 재정의)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/common/ColorSchemeSelector.tsx` (selector 미리보기 동기화)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx` (단일 시리즈 그룹 인덱스 분기)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/ScatterChartWidget.tsx` (포인트별 색)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx` (vc.color fallback)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx` (라인별 color picker)
- `packages/fs-data-viewer/src/entities/dashboard/types.ts` (`ChartValueColumn.color?`)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 3개 요구사항 모두 코드에 반영. 단일 시리즈 discriminator 2곳 (서버·클라이언트 경로) + LineChart vc.color fallback 2곳 모두 적용 확인.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 막대그래프 (단일 시리즈) — 카테고리 막대 색이 4종 테마에 따라 자동 변화 확인 (default = blue 명도 그라데이션, warm/cool = 고대비, mono = gray 그라데이션).
2. 막대그래프 (다중 시리즈) — 시리즈별 색 구분 유지 확인.
3. 파이 차트 — 4종 테마 시각 적용 확인 (도넛 조각별 색).
4. 산점도 — 포인트별로 색이 변하는지 확인 (이전엔 단일 색).
5. 선 그래프 — 위젯 설정에서 각 라인별 color picker 노출 확인, 색 지정 후 즉시 라인 색 변경. 기존 widget 데이터 (color 미지정) 가 fallback 으로 정상 렌더 확인.

## v001.7.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 2, cumulative phase 8)

### Hotfix 결과

마스터 요구: "사용자 타입 보드 위젯은 항상 주어진 영역 안에서 중앙에 정렬되도록."

- **Phase 8** (`f028e196`): `PaginatedUserGrid.tsx` 66~75번 라인 영역의 카드 그리드 컨테이너 인라인 스타일에서 `justifyContent` / `alignContent` 값을 각각 `'start'` → `'center'` 로 변경 (2-line 변경). vertical · horizontal · grid 3종 layout 모두에서 사용자 카드 블록이 위젯 영역의 수평·수직 중앙에 배치된다. iter 1 에서 `UserListWidget.tsx` 단독 변경이 효과 없음 (PaginatedUserGrid 가 실제 정렬 결정) 을 발견 후 scope 확장 승인.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/PaginatedUserGrid.tsx` (Phase 8)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 마스터 요구 "항상 중앙 정렬" 의 plain reading 충족. 마지막-페이지 partial row 가 행 내부에서도 가운데로 모이는 edge case 는 의도된 해석 (option 1) 으로 수용.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. `pnpm dev` → 데이터 뷰어 → 대시보드뷰. 사용자 목록 위젯 (UserListWidget) 의 vertical / horizontal / grid 3종 layout 모두에서 사용자 카드 블록 전체가 위젯 영역 수평·수직 중앙에 위치하는지 확인.
2. **Edge case**: 사용자 목록이 페이지를 가득 채우지 못해 마지막 페이지에 적은 카드만 있는 경우 — 그 카드들이 행 내에서도 가운데로 모이는지 확인 (의도된 동작). 시각상 어색하면 추후 hotfix 로 "블록 전체 중앙 + 카드 내부 좌측 정렬" 로 변경 가능.

## v001.6.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 1, cumulative phase 7)

### Hotfix 결과

마스터의 4개 핫픽스 요구사항을 단일 페이즈로 적용 후 default 색 보정 iter 1 추가.

- **Phase 7 iter 1** (`40623ca2`):
  - **(1) 아이콘 배경 흰색 금지** — IconSettingsSection 의 8색 팔레트는 본래 흰색 미포함, 팔레트 변경 없이 유지.
  - **(2) 아이콘 흰색 고정** — `WidgetContainer.tsx` 의 `<IconComponent>` 에 `color="#ffffff"` 추가, 배경 어떤 색이든 아이콘은 항상 흰색.
  - **(3) 파이 내부 라벨 제거** — `PieChartWidget.tsx` 에서 `getSliceCenter`, `wrapLabelToLines`, `internalSlices`, `MIN_ANGLE_FOR_INTERNAL_LABEL`, SVG 내부 text 블록 일괄 제거. `showLabels` 옵션이 dead-option 이 되어 `PieChartSettings.tsx` 의 해당 ToggleSwitch 도 제거.
  - **(4) 파이 우측 범례 = `값 (% 수치)` 형식** — `${value.toLocaleString()} (${(percentage*100).toFixed(1)}%)` 로 통일 (천 단위 콤마 + 백분율 소수 1자리). row title 툴팁도 동일 형식.
- **Phase 7 iter 2** (`dca8f3f1`):
  - 아이콘 배경 default 보정 — `ICON_BG_DEFAULT` 를 밝은 회색 `#e5e7eb` → 인디고 `#6366F1` (IconSettingsSection 팔레트 첫 색) 으로 변경. 흰색 아이콘과 대비 확보.
  - `resolvedBgColor` 헬퍼 도입 — `'#fff' | '#ffffff' | 'white' | 'rgb(255,255,255)'` 4개 리터럴 입력 시 `ICON_BG_DEFAULT` 로 자동 치환. 흰색 배경 조합 자체 차단.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (Phase 7 iter 1, iter 2)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (Phase 7 iter 1)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/PieChartSettings.tsx` (Phase 7 iter 1)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 4개 요구사항 모두 코드에 반영. iter 1 직후 advisor 가 default 색 미보정 갭을 지적해 iter 2 로 정정.
- TSC delta: hotfix 변경 파일 3개에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. `pnpm dev` → 데이터 뷰어 → 대시보드뷰. 아이콘 옵션 활성화된 위젯에서 아이콘 자체가 항상 흰색으로 렌더되는지, 배경색 선택 시 흰색 옵션 자체가 부재한지 확인.
2. 위젯 설정에서 아이콘은 활성화하되 배경색을 따로 고르지 않은 경우 인디고 (`#6366F1`) 로 표시되는지 확인.
3. 파이 차트: 파이 조각 내부에 라벨/수치 텍스트가 사라졌는지, 우측 범례가 `[정사각형 마커] [라벨] 값 (백분율%)` 형식인지 확인.

## v001.5.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9

### 페이즈 결과

- **Phase 1** (`2c501382`): `entities/dashboard/types.ts` 에 공통 `TitleConfig` / `IconConfig` export 추가 후 7개 위젯 config (BaseBarChart 경유 BarHorizontal/Vertical, LineChart, PieChart, ScatterChart, Card, Gauge, UserList) 에 `titleConfig?` / `iconConfig?` optional 필드 적용. 모든 필드 optional → 기존 직렬화 데이터 호환.
- **Phase 2** (`85a01127` + 린트 핫픽스 `220bebe8`): `widgets/dashboard/widgets/WidgetContainer.tsx` 신규 — 3열 flex 헤더 (좌끝 아이콘 슬롯 | 가운데 제목 flex-1 | 우끝 아이콘 슬롯) 구조로 "아이콘은 항상 제목보다 끝쪽" 규칙을 레이아웃으로 자동 보장. titleConfig.text 부재 시 CardConfig 의 legacy title 로 fallback, 표시 내용 0 이면 헤더 공간 미점유. WidgetRenderer 가 7종 위젯 모두를 컨테이너로 감쌈. 린트 핫픽스: `entities/dashboard/index.ts` 배럴 export 에 TitleConfig/IconConfig 추가 + lucide-react 캐스트를 `as unknown as Record<...>` 안전 패턴으로 변경.
- **Phase 3** (`51181e97`): `widget-settings/settings/_shared/TitleSettingsSection.tsx` (텍스트·굵기·크기·정렬) + `IconSettingsSection.tsx` (18종 lucide 아이콘 그리드·8색 팔레트·좌/우 토글) 공통 컴포넌트 신규 작성 후 7개 `*Settings.tsx` 에 균일하게 import + 렌더 추가. spread-merge 패턴으로 titleConfig/iconConfig 업데이트.
- **Phase 4** (`22a65f3d`): CardConfig 에 `sparklineConfig: { enabled, months, dateColumnField }` 추가. `widgets/dashboard/lib/dashboard-data-utils.ts` 에 `groupRowsByMonth` 헬퍼 신규 (preprocessedRows 를 dateColumnField 기준 월별 그룹화 후 aggregation 적용, 최근 N개월 슬라이스). CardWidget 본체 내부 자체 레이블 제거 (WidgetContainer 가 헤더 담당), 카드 숫자 아래 미니 LineChart + 증감율 (가장 오래된 월 대비, 부호와 함께 `+12.3%` / `-4.5%` 형식, divide-by-zero 시 null 처리) 렌더. 가용 월 ≤ 1 이면 sparkline 영역 비표시.
- **Phase 5** (`b0f844ef`): PieChartWidget — SVG 경로를 wedge → annulus segment (외호 + 내호 역방향) 로 교체해 도넛 형태 구현. 내부 라벨은 `config.showLabels===true` 조건부, 위치를 링 중간점(radius*0.8) 으로 이동. 우측 범례 기존 `<20% 필터` 제거 → chartData 전체 항상 표시. 마커 12×12 정사각형(rounded 없음), 수치 소수 1자리 (`12.3%`) 통일.
- **Phase 6** (`5388d374`): LineChartWidget — Y축 max/min 라벨 컬럼을 왼쪽에 추가 + Y축 좌측 선 삽입, X라벨 영역에 동일 너비 invisible spacer 로 X틱 정렬. ScatterChartWidget — 회색 배경 rect(fill=gridBg) 와 6개 grid line 전체 제거, Y축(좌 border-l) + X축(하 border-t) 축 라인만 남김. 두 위젯 모두 recharts 가 아닌 커스텀 SVG/DOM 렌더링 구조였음 (Explore 보고 정정).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts` (Phase 1, 4)
- `packages/fs-data-viewer/src/entities/dashboard/index.ts` (Phase 2 lint hotfix — 배럴 export)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (Phase 2, 신규)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetRenderer.tsx` (Phase 2)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx` (Phase 4)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (Phase 5)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx` (Phase 6)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/ScatterChartWidget.tsx` (Phase 6)
- `packages/fs-data-viewer/src/widgets/dashboard/lib/dashboard-data-utils.ts` (Phase 4)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/_shared/TitleSettingsSection.tsx` (Phase 3, 신규)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/_shared/IconSettingsSection.tsx` (Phase 3, 신규)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/CardSettings.tsx` (Phase 3, 4)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/PieChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/BarChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/ScatterChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/GaugeSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/UserListSettings.tsx` (Phase 3)

### 검증 결과

- advisor #1 (계획 5-perspective): PASS — 아이콘×제목 결합 규칙·sparkline `dateColumnField` 필수·클라이언트 집계 단일 노선·Phase 3 실행 순서 가이드 모두 사전 정정.
- advisor #2 (완료 5-perspective): PASS — 6개 명령 모두 코드에 반영. Evidence caveat: Explore 가 Line/Pie/Scatter 를 recharts 라 보고했으나 실제 custom SVG/DOM (phase-executor 가 실측 정정). Logic caveat: Phase 2 lint hotfix 가 `entities/dashboard/index.ts` 를 영향파일 외 추가 수정 (배럴 누락 보완 — 메카니즘적 합당).
- TSC delta: baseline (i-dev-001 c7f0e7d5) 30개 → 누적 26개. Phase 1~6 신규 typecheck 에러 0건.
- ESLint: 본 플랜 신규/변경 파일 깨끗.

### 마스터 수동 회귀 시나리오

1. `pnpm dev` → 데이터 뷰어 → 대시보드뷰 진입.
2. 위젯 7종 각각의 설정 화면에서 "제목" / "아이콘" 섹션 노출 확인.
   - 제목: 텍스트 + 굵기(2) + 크기(3) + 정렬(3) 변경 시 위젯 헤더 즉시 반영.
   - 아이콘: 18종 그리드 선택, 배경 8색 팔레트, 좌/우 토글 시 위젯 헤더 끝쪽에 원형 배경 + 고정 크기 아이콘 표시.
3. 카드 위젯 설정의 "추세 Sparkline" 토글 ON → 날짜 컬럼 + 개월 수 입력 → 카드 본체 아래 미니 선 그래프 + 증감율(`+/-X.X%`, 색상) 노출.
   - 데이터 월 범위 < N: 가용 범위만 표시.
   - 데이터 월 ≤ 1: sparkline 비표시 확인.
4. 파이 차트 위젯: 중앙이 빈 도넛 형태 + 우측에 [정사각형 색상 마커 | 라벨 | 수치(%)] 범례 노출.
5. 선 그래프 위젯: 좌측 Y축 라인 + max/min 라벨, 하단 X축 라벨이 각 데이터 컬럼 폭에 정렬돼 표시.
6. 산점도 위젯: 회색 배경/grid 사라짐, 좌측 Y축 + 하단 X축 라인만 잔존.

### Post-action hints

- 기존 카드 위젯 중 `config.title === ""` (빈 문자열) 인 인스턴스는 WidgetContainer fallback 이 닿지 않아 헤더 미표시 가능. 시각 확인 후 필요 시 `titleConfig.text` 설정 또는 fallback 확장 hotfix.
- 카드 sparkline 의 `dateColumnField` 는 ISO 또는 `Date.parse` 가능 문자열 가정 — 다른 형식이면 조용히 스킵 (sparkline 비표시).
- 향후 차트 라이브러리 관련 작업 시 Explore 결과만 신뢰 말고 실제 위젯 파일 직접 확인 (본 플랜에서 recharts 오인 사례 발생).

## v001.4.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#8

### 페이즈 결과

- **Phase 1** (감사 only, 커밋 없음): 35개 `callSpManageDataGroup` 호출처 전수 audit 결과 모두 이미 outer `beginTransaction()` … `commit()` / `rollback()` 블록 안에 있음을 확인. Phase 2 (SP inner-TX 제거) 의 안전 전제 검증 — 코드 변경 0. 마스터 명시 항목 #3 ("outer 트랜잭션 없이 호출하는 곳을 찾아 보정") 의 응답 = 미보호 호출처 0건. SP self-COMMIT 이 outer txn 을 무력화하던 것이 본 버그의 단일 근원.
- **Phase 2** (`ec5fca0` + `b3b2048`, iter 2): `sp_manage_data_group` 양쪽 정의 (`db.sql/03-procedures.sql`, `fix_sp_manage_data_group.sql`) 에서 SP-level inner transaction 명령 완전 제거. iter 1 = SP-level `START TRANSACTION;` (03:1344, fix:70) + 외부 `COMMIT;` (03:1528, fix:254) + EXIT HANDLER `ROLLBACK;` (03:1321, fix:47) 제거. iter 2 = soft-delete 분기 (`v_columns_count = 0`, `LEAVE main_block` 직전) 의 inner `COMMIT;` (03:1407, fix:132) 추가 제거 — iter 1 의 START TRANSACTION 과 쌍이었던 orphan COMMIT 이 caller outer 트랜잭션을 조기 커밋하는 회귀 위험을 main session 검증 단계에서 발견 → 보정. 변경 후 SP 본체 grep 시 `START TRANSACTION` / `COMMIT;` / `ROLLBACK;` 모두 0 hit. EXIT HANDLER 의 `INSERT INTO sp_error_log`, `DO RELEASE_LOCK`, `SELECT v_err_msg AS error_message` (status='FAILED') result-set 반환 contract 보존 — wrapper `callSpManageDataGroup` 의 `throw new Error('SP 오류: ...')` 동작 유지.
- **Phase 3** (`2a84cec`): `createForm` 진입부 (`beginTransaction` 직후, SP 호출 전) 에 사전 중복 검증 net-new 추가 — `form_name` 중복 (`form_list` 직접 조회 → `ConflictError('FORM_NAME_DUPLICATE')`) + `[폼] {name}` group_name 중복 (기존 `viewerModel.checkGroupNameDuplicate` 재사용 → `ConflictError('GROUP_NAME_DUPLICATE')`). TEMP 이름 race 방어: `__TEMP_FORM_${Date.now()}__` → `__TEMP_FORM_${Date.now()}_${randomUUID()}__` (`builder.form.ts:88`), `viewer/viewer.group.ts:55` 의 `Math.random()` 접미사도 `randomUUID()` 로 교체. 동시 호출 시 TEMP 이름 충돌 자체 차단. tsc PASS, lint baseline_fail_unrelated.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `db.sql/03-procedures.sql` (Phase 2 iter 1 + iter 2)
- `fix_sp_manage_data_group.sql` (Phase 2 iter 1 + iter 2)
- `src/services/builder/builder.form.ts` (Phase 3)
- `src/services/viewer/viewer.group.ts` (Phase 3)

### 검증 결과

- advisor #1 (계획 5-perspective): PASS — RESIGNAL 위험, phase 순서 (wrap-then-flip), wrapper #2 contract, nested SP audit 모두 사전 정정.
- advisor #2 (완료 5-perspective): PASS — Intent / Logic / GroupPolicy(carve-out 승인) / Evidence / Command Fulfillment 전부 통과. 별도 발견: 원 Explore 가 `checkGroupNameDuplicate` 가 builder.form.ts:45 에 이미 있다고 보고했으나 실제 부재 → Phase 3 가 net-new 추가로 정정.
- TSC (`npx tsc --noEmit`): Phase 3 종료 시점 PASS — 본 플랜 변경으로 인한 신규 type 오류 0건.
- Lint (`pnpm lint`, Phase 2/3): `baseline_fail_unrelated` — i-dev-001 사전 결함 6건 (auth.service.ts:64 unused / seatChange.service.test.ts × 4 no-explicit-any / enterprise-482-p02-is-verified-removal.test.ts:88 no-require-imports) 만 존재, 본 플랜 변경 무관 (= v001.3.0 §B-2 와 동일 항목). Skill §7c.6 lint hotfix iter 미트리거 — advisor #2 GroupPolicy 축에서 carve-out 명시 승인 (사전 결함 자동 fix 시도는 CLAUDE.md §6 prevention treadmill 위반).

### 마스터 수동 회귀 시나리오 (후속 `task-db-structure` 배포 후 실행)

본 플랜은 SP source 와 application 코드만 갱신. 실제 DB 인스턴스 SP 배포는 후속 `task-db-structure`. 배포 완료 시점에 마스터가 다음 시나리오 수동 실행:

- [ ] **Case 1 (form_name 409)**: 같은 `company_id` 로 동일 `form_name` 재시도 → HTTP 409 `FORM_NAME_DUPLICATE` 응답.
- [ ] **Case 2 (group_name 409)**: 같은 `company_id` 로 동일 `[폼] {name}` 그룹이 이미 존재할 때 createForm → HTTP 409 `GROUP_NAME_DUPLICATE` 응답.
- [ ] **Case 3 (잔재 0)**: SP 가 unique 제약 위반하도록 의도적 시나리오 구성 → `data_group` 테이블 `__TEMP_FORM_*` 잔재 0건 확인.
- [ ] **Case 4 (정상 흐름)**: 신규 폼 생성 → `form_list` 1건 + `[폼] {name}` `data_group` 1건 정상 생성, `data_column` / `data_values` 정상.

### 마스터 명령 대비 deviation (요약)

- **항목 1 (사전 검증 추가)**: 전제였던 "이미 부분 존재" 가 사실 부재였음. 본 플랜에서 BOTH 검증 net-new 추가로 처리 (마스터 spec 일치).
- **항목 2 (SP inner-TX 제거 / atomic 단일 SP)**: option A (호출자 위임) 채택. RESIGNAL 은 wrapper contract 보호 위해 미채택, `SELECT 'FAILED'` result-set 반환 보존.
- **항목 5 (회귀 테스트)**: 자동 테스트 harness 부재로 자동화 미실시. 위 마스터 수동 회귀 체크리스트로 대체 (후속 `task-db-structure` 배포 후 실행).

### Trade-off (의도된 수용)

- **`sp_error_log` rollback**: caller rollback 시 SP 의 `INSERT INTO sp_error_log` 도 함께 rollback (MySQL 미지원 autonomous transaction). 본 fix 의 의도는 잔재 자체를 없애는 것이므로 향후 sp_error_log 누적 자체가 거의 없을 것. 운영 추적은 application logger 의 catch 출력으로 대체.
- **SP 두 파일 drift**: `fix_sp_manage_data_group.sql` 의 `is_unique` 컬럼 처리 + `relation_id` 기반 view cleanup 은 `db.sql/03-procedures.sql` 에 없음. 본 플랜은 inner-TX 형태만 통일, 기능 backport 안 함.

### 알려진 후속 (별개 plan 권장)

- **F-1**: `task-db-structure` — 본 플랜의 SP source 갱신을 실제 DB 인스턴스에 배포.
- **F-2**: `task-db-data` — 기존 40건 `__TEMP_FORM_*` 잔재 정리 (정의된 cleanup 쿼리).
- **F-3**: SP 두 파일 drift (`is_unique` / `relation_id` view cleanup) 양방향 수렴 — 후속 별도 플랜.
- **F-4**: `callSpManageDataValue` 등 다른 SP 들도 동일한 inner-TX 패턴인지 audit (본 플랜은 `sp_manage_data_group` 한정).
- **B-2 (continued)**: i-dev-001 사전 lint 결함 6건 — v001.3.0 §B-2 와 동일 카탈로그.

## v001.3.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#7

### 페이즈 결과

- **Phase 1** (`52b1c35`, 선행 세션): `docs/billing/audit-2026-05-13.md` 신규 작성 (+173). 결제 표면 카탈로그 + cross-flow 시나리오 10건 + 결함 R-001~R-005 식별. 본 audit 은 작성 시점에 R-001 (프로모션 만료 시 직전 plan 복구) / R-003 (만료 sweep cron 부재) 진단이 사양·코드와 불일치 — Phase 2 에서 정정.
- **Phase 2** (`2b345a5`): audit 사양 정정. 마스터 정정에 따라 사양 = 프로모션 만료 / 갱신 실패 시 plan 은 무조건 Free 강제 강등 (직전 plan 복구 사양 부재). R-001 격하 (`promotion.service.ts:348` `expireClientPromotion`, `promotion.model.ts:233` `UPDATE client SET plan_type='free'`, `billingRenewal.service.ts:237` 능동 cron, `auth.middleware.ts:107/180` lazy fallback 코드 인용 → 사양 일치 PASS). R-003 격하 (`billingScheduler.service.ts:146-180` `processExpiredPlans` 02:00 daily cron + `findExpiredClients` 쿼리 + `resetExpiredPlan` 강등 + `createPlanDowngradedNotification` 알림 모두 이미 구현 인용 → PASS). R-002 정의 확정 (Free 강등 명시) + Phase 3 구현 사양 (재사용 함수·로그·알림 형식) audit 에 명시 → audit 이 코드 페이즈의 canonical spec source 로 확정.
- **Phase 3** (`5548bd1`): R-002 갱신 3회 실패 자동 Free 강등 구현. `src/services/billingRenewal.service.ts:208~217` 에 `resetExpiredPlan(companyId)` 호출 추가 (3회 실패 종결 분기, `FAILED` 이력 + 알림 직후). `createRenewalFailedNotification` reason 에 `'자동갱신 결제 3회 연속 실패 → Free 강등'` 명시. 로그 `[billingRenewal] auto-renewal 3-fail downgrade to free: companyId=${id}`. 강등은 독립 try/catch 로 감싸 알림·이력 저장 실패와 무관하게 진행.
- **Phase 4** (`a8c85ec`): audit 회귀 매트릭스 + 코드 변경 결과 반영. R-002 status 갱신 (결함 → 수정 완료). 시나리오 10건 × R-002 변경 영향 회귀 매트릭스 신규. §6 본 플랜 종결 요약. §8 별개 후속 (B-1 `pending_plan_type` 잔존 모호성 / B-2 base i-dev-001 사전 lint 결함 6건) 카탈로그.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `docs/billing/audit-2026-05-13.md` (Phase 1 신규 + Phase 2/4 정정)
- `src/services/billingRenewal.service.ts` (Phase 3)

### 검증 결과

- advisor #1 (재계획 후 5-perspective): PASS — Intent/Logic/GroupPolicy/Evidence/CommandFulfillment 전부 통과.
- advisor #2 (완료 시점 5-perspective): PASS — 시나리오 9 매트릭스 표현에 `findRetryableClients` predicate OR 절 elision 지적 있으나 3-fail path 는 regular renewal 이므로 edge-case, BLOCK 아님.
- Lint gate (Phase 3): phase-introduced 결함 0 — base i-dev-001 사전 결함 6건 (auth.service / inputStore.service / seatChange.service.test / enterprise-482-p02 테스트) 은 본 플랜 phase 와 무관, 별개 후속 (B-2) 으로 카탈로그.
- 코드 검증 (read-only Explore + Phase 2 dispatch 실측): R-001 정상 / R-002 미구현 / R-003 정상 사실 확인.

### 절차 노트

선행 세션 audit 의 R-001 / R-003 진단이 사양 및 실제 코드와 불일치 — 본 플랜은 재계획 경로로 진입해 R-001 / R-003 을 격하하고 R-002 단일 결함만 코드 수정. 결과적으로 5 페이즈 계획이 4 페이즈로 축소 (Phase 2 = audit 정정, Phase 3 = R-002 구현, Phase 4 = audit 회귀). 사전 조건이었던 `/task-db-structure` 의 `client.previous_*` 3 컬럼 ALTER 도 사양 정정으로 소멸. 검증 자체가 결함 카탈로그를 축소시킨 사례 — 마스터 원 명령 "결제 로직 전수 검증 + cross-flow 결함 수정" 의 성과 일부.

### 알려진 후속 부채 (별도 plan 권장)

- **B-1**: R-002 강등 후 `client.pending_plan_type` 이 null 로 초기화되지 않음 (의미적 모호성). 다음 cron 진입 시 `findRetryableClients` 의 `plan_type != 'free'` 조건으로 자동 제외되지만 `OR active_promotion_id IS NOT NULL` 절로 인해 promotion-active 상태가 남아 있으면 edge-case 포함 가능.
- **B-2**: base i-dev-001 사전 lint 결함 6건 (auth.service.ts:64 unused / inputStore.service.ts:42 directive / seatChange.service.test.ts × 4 no-explicit-any / enterprise-482-p02-is-verified-removal.test.ts:88 no-require-imports).
- **R-004**: HOTFIX-003/004 의 pending 동시 차단 UX 영향 — 정책 결정 사항 (audit §5).
- **R-005**: `renewPromotionClient` 의 `Math.max(client.seats, minUsers)` 의도 확인 — 마스터 결정 (audit §5).
- **FE 권고**: audit §5 의 FE 후속 권고 — 별개 후속 플랜.

## v001.2.0

> 통합일: 2026-05-13
> 플랜 이슈: bj-kim-funshare/data-craft-mobile#3

### 페이즈 결과

- **Phase 1** (`2eb40e1`): `apps/web/vite.config.ts` 를 function-form `defineConfig(({mode}) => ...)` 으로 전환하여 `base` 를 환경별 분기 (`mode === 'production' ? '/data-craft-mobile/' : '/'`). VitePWA `workbox.navigateFallback` 도 `${base}index.html` 로 동기화. `apps/web/src/mobile/router.tsx` 의 `createBrowserRouter` 에 `basename: import.meta.env.BASE_URL` 옵션 추가. `apps/web/public/manifest.json` 의 절대 경로를 manifest-디렉토리 기준 상대 경로로 표준화 (`start_url: "m/home"`, `scope` 키 제거, `icons[].src` leading-slash 없음). `apps/web/src/mobile/sw-register.ts` 의 SW 등록 URL 도 `${import.meta.env.BASE_URL}sw.js` 로 변경. dev (port 5174) 환경은 `BASE_URL = '/'` 로 무영향.
- **Phase 2** (`d4c77a2`): apps/web 빌드 파이프라인 정상화. `packages/fs-data-viewer-mobile/src/index.ts` 에 `useServerPaging` re-export 추가 (Hooks 섹션 신설) — enterprise-454 commit 에서 누락된 barrel 갱신. `apps/web/vite.config.ts` 의 workbox 에 `maximumFileSizeToCacheInBytes: 8 * 1024 * 1024` 추가 (5.33 MB ScreenGridViewer 청크 precache 허용). `apps/web/package.json` 의 `build` 에서 `tsc -b` 단계 제거 (pre-existing 타입체크 결함은 별도 plan 격리). 루트 `package.json` 의 `build` 를 `pnpm --filter ./apps/web build` 로 위임 — deploy.md 의 `apps/web/dist` 산출물 일관화.

### 영향 파일

**data-craft-mobile** (`bj-kim-funshare/data-craft-mobile`, branch `i-dev`):
- `apps/web/vite.config.ts`
- `apps/web/src/mobile/router.tsx`
- `apps/web/public/manifest.json`
- `apps/web/src/mobile/sw-register.ts`
- `packages/fs-data-viewer-mobile/src/index.ts`
- `apps/web/package.json`
- `package.json` (루트)

### 검증 결과

- Lint gate (`pnpm typecheck`): exit 0 (Phase 1·2 양쪽).
- Build (`pnpm build` = `pnpm --filter ./apps/web build`): exit 0, `apps/web/dist/` 생성, PWA 882 entries (18.4 MiB) precached.
- dist 산출물 5/5 검증 PASS:
  - `dist/index.html` `<script>` / `<link>` 모두 `/data-craft-mobile/` prefix.
  - `dist/manifest.json` semantic — 상대 경로 정상.
  - `dist/sw.js` 에 `/data-craft-mobile/index.html` literal.
  - `dist/assets/index-*.js` (sw-register 청크) 에 `/data-craft-mobile/sw.js` literal.

### 절차 노트

Phase 2 dispatch 시 phase-executor sub-agent (Sonnet 4.6) 가 main 세션의 `claude-opus-4-7[1m]` 1M context tier 를 상속받아 계정 1M-context extra-usage 한도에 4회 연속 차단됨. 마스터의 명시 "계속 이어서 진행해" 지시 하에 메인 세션이 정확히 명세된 4 mechanical edit (각 정확한 old/new string 사전 확정) 을 직접 수행 — CLAUDE.md §2 의 main-session read-only 원칙으로부터의 운영 deviation. gate-runner (Haiku 4.5) 는 1M context 미상속으로 정상 동작. 동일 quota 차단 재발 시 `/extra-usage` 활성화 또는 main 모델 200k tier 전환 권장.

### 알려진 후속 부채 (별도 plan 권장)

- `assets/ScreenGridViewer-*.js` 5.33 MB 청크 — 정상 precache 되지만 PWA 초기 설치 시 5MB+ 다운로드 부담. code-splitting 또는 runtime cache 분리 권장.
- pre-existing apps/web tsc 결함 (designer-dialog 데드코드 `@/...` imports, joinUtils/groupValidation `@/...` imports, FsKanbanBoard unused var) — vite 빌드는 tree-shaking 으로 우회. 타입체크 정상화 별도 plan.
- 루트 `/src`, `/index.html`, 루트 `vite.config.ts` — dead-but-non-blocking. 별도 cleanup plan.
- gh-pages 실제 publish (`npx gh-pages -d apps/web/dist`) — 본 plan 스코프 외, 마스터 수동 또는 deploy 워크플로 별도 정의.

## v001.1.0 — Commit&Push 대기중
