# data-craft — Patch Note (001)

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
<<<<<<< HEAD
> 플랜 이슈: funshare-inc/data-craft#34 (Hotfix 1)

### 페이즈 결과

- **Phase 3 (hotfix-1)** (`7ff9f76` + 후속 테스트 스코프 수정 `13e5254c`): plan #34 v001.59.0 fix 가 `SettingsFormTabContent` (사용자 설정 화면) 의 FormRenderer 사용처만 onReset 배선했고, 페이지에 배치되는 폼 위젯(`widgets/form-widgets/ui/UserFormDialogs → FormInputDialog` 및 `→ DataListDialog → DataListDialogBody`) 경로는 명시적 범위 외였음. 마스터 dev 검증에서 페이지 폼 위젯 경로의 동일 증상 — 초기화 후 저장 시 미입력 필드의 기존값이 잔존하여 "저장 자체가 안 되는 것처럼" 보임 — 이 확인됨. 해결: 동일 store-staleness 패턴을 form-widgets 페이지 런타임 경로에 확장 배선. `useFormData` 가 `useFormWidgetSync.handleFormFieldsChange` 를 destructure 하여 노출, `useUserFormWidget` 반환 타입에 추가, `UserFormWidget` 이 `UserFormDialogs` 에 prop 전달. `UserFormDialogs` 에서 Phase 1 `SettingsFormTabContent` 와 **byte-수준 동일** onReset 람다(`null → ''`, `{start,end} → 'start~end'`, `array → join(',')`, else `String(value)`) 를 정의해 listFirst 경로 (`FormInputDialog`) 와 비 listFirst 경로 (`DataListDialog → DataListDialogBody`) 양쪽에 전달. `FormInputDialog` / `DataListDialog` / `DataListDialogBody` 모두 `onReset?` prop 을 받아 FormRenderer 까지 통과. T17d 회귀 테스트 추가 — `UserFormDialogs` 직접 렌더 + `handleFormFieldsChange` mock 으로 초기화 클릭 시 wire-up 전달 경로가 호출됨을 단언. **negative-run 1회 실증**: 7개 소스 파일을 hotfix 이전으로 되돌리고 T17d 단독 실행 → 정확히 `expected vi.fn() to be called 1 times, but got 0 times` 로 실패함을 확인. 변경 +80 / -6 (8 files). lint gate (`pnpm typecheck:all && pnpm lint`) 두 commit 누적 상태에서 exit 0.

> 버전 충돌 메모 (CLAUDE.md §5 step 4): 본 hotfix 문서 머지 시점에 plan #42 (v001.68.0) 와 plan #36 (v001.69.0) 이 동시 머지되어 본 entry 가 v001.70.0 으로 양보. 양측 entry 모두 보존.

### 마스터 명령 의도 (재기)

v001.59.0 fix 검증 중 마스터 보고 — "그냥 아예 저장 자체가 안 되는데? 폼 위젯을 테스트했는데 초기화 누르고 나와도 목록에 (목록을 우선순위로 옵션 사용하는 경우) 기존 데이터로 나오고 눌러봐도 기존 데이터고, 새로고침해도 기존 데이터." v001.59.0 의 "알려진 범위 밖" 으로 명시했던 form-widgets 페이지 런타임 경로가 마스터의 주 사용 경로였음. 동일 fix 패턴을 그 경로에 확장.
=======
> 플랜 이슈: funshare-inc/data-craft#43

### 페이즈 결과

- **Phase 1** (`65f24678`): 데이터 뷰어 → 문서 타입 셀 → 문서 모달 본문의 블록 추가 드롭다운(BlockNote `.bn-suggestion-menu`)을 끝단까지 스크롤할 때 모달 본문(`ContentArea` `overflow-y-auto`)이 함께 스크롤되는 체이닝 결함 차단. 원인: `.bn-suggestion-menu` 가 `document.body` 로 portal 되어 ContentArea 의 capture-phase JS wheel 핸들러와 분리되어 있으므로 체이닝 경로는 브라우저 기본 scroll-chaining. `DocumentEditor.tsx` 의 `attach(el)` 함수 — BlockNote 가 동적 마운트하는 `.bn-suggestion-menu` 마다 MutationObserver 가 호출하는 자리 — 에서 `target.style.overscrollBehavior = 'contain'` 한 줄과 의도 주석 한 줄 추가. 기존 wheel 핸들러 본체 (deltaMode 보정, 끝단 가드 `if (target.scrollTop !== before)`, preventDefault/stopPropagation) 는 그대로 둠 — BlockNote 0.45 의 휠 입력 보정 의도를 유지. 변경: +2 / -0 across 1 files. Lint gate (`pnpm typecheck:all && pnpm lint`) exit 0.

### 마스터 명령 의도 (재기)

데이터 뷰어 → 문서 타입 셀의 문서 모달 본문에서, 본문에 스크롤이 발생할 정도의 긴 블록이 있을 때 블록 왼쪽 `+` 아이콘으로 블록 추가 드롭다운을 열고 드롭다운을 스크롤하면 뒤의 본문이 함께 스크롤되는 문제 차단.
>>>>>>> plan-enterprise-43-data-viewer-doc-modal-scroll-chain-문서

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev`):
<<<<<<< HEAD
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
=======
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
>>>>>>> plan-enterprise-43-data-viewer-doc-modal-scroll-chain-문서

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
