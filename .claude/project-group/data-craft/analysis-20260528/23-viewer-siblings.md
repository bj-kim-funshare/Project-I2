# 형제 뷰어 포크 회귀 (fs-sub-data-viewer · fs-external-data-viewer)

> 두 패키지는 정본 `fs-data-viewer` 의 포크(파일명 ~1,095 공유, 내용 ~860 분기). diff 검토로 정본 대비 **분기가 도입한 버그/회귀**만 보고. 정본과 동일한 파일은 정본 발견을 상속. 검증 VS-4: 10 CONFIRMED, 4 ADJUST(아래 반영), 0 반증.

---

## 버그 클래스

### SUB-DIFF-A-001 (high · bug) — sub 뷰어 `autoTransformRow` 가 정본 BUG-311 null guard 상실 → null row 에서 크래시
- 파일: `fs-sub-data-viewer/src/features/grid/hooks/server-paging/serverRowTransform.ts:16`
- 정본은 `if(!row){...return {rowField:-1,cellModelList:[]}}`(BUG-311) 가드 후 프로퍼티 탐침. 포크는 구버전 본문으로 회귀하여 즉시 `'row_num' in row` 평가 → null/undefined 에서 `TypeError`. 라이브 서버 페이징 응답마다 `autoTransformPagedResult`/`autoTransformGroupedResult` 가 `result.rows`/`group.rows` 에 map 하므로 null/sparse 항목 하나가 전체 transform 크래시 → 페이지 로드 중단. 정본 주석이 이 회귀 클래스 명시.

### SUB-DIFF-A-002 (medium · bug) — sub 뷰어가 정본이 교체한 약한 FsGridRowModel 판별자 사용
- 파일: `fs-sub-data-viewer/.../serverRowTransform.ts:18`
- 정본은 isFsGridRowModel 타입가드(rowField number + cellModelList Array)로 이미 변환된 행 pass-through. 포크는 `'row_num' in row && !('rowField' in row)` 단독. row_num 누락 shape 는 미변환 반환(cellModelList 정규화 안 됨), 이미 변환된 행이 row_num 보유 시 재변환 → 하류가 undefined 읽음. shape 엣지케이스 의존이라 001보다 낮음.

### SUB-DIFF-B-001 (high · bug) — `ServerPagingOverlay` 훅 호출 전 조건부 early-return → Rules-of-Hooks 크래시
- 파일: `fs-sub-data-viewer/src/widgets/grid-table/components/ServerPagingOverlay.tsx:17`
- prop 을 `UseServerPagingResult | null` 로 확장(정본은 non-null)하고 `if(!serverPaging) return null`(L17)을 `useState`(L23)·`useEffect`(L25) **앞에** 배치, `eslint-disable react-hooks/rules-of-hooks`(L22/24)로 억제. caller `FsGridTableView`(`tv.serverPaging`)가 런타임 nullable(`?.`/`if(!tv.serverPaging)` 가드 다수). 서버 페이징 비활성↔활성(또는 첫 렌더 null→config 후 채워짐) 전환 시 0훅 렌더 ↔ 2훅 렌더 → 'Rendered more hooks than during the previous render' → 그리드 뷰 서브트리 크래시. → SYS-002.

### EXT-DIFF-A-001 (high · bug) — external 뷰어 meta 로드가 showVersionInfo/showSaveState/descriptionTagList 무음 누락 → 저장 설정 미복원
- 파일: `fs-external-data-viewer/src/app/hooks/useViewerMetaLoader.ts:131`
- meta→viewerModel 매핑(L120-131)이 정본이 매핑하는 3개 grid-setting 키 누락. 이는 view-mode(calendar/gantt 등) 제거 대상이 아니라 external 뷰어에서 여전히 active 소비: settings-handlers 가 showVersionInfo(L117-121)/showSaveState(L126-130)를 createGridSettingChange(immediate:true)로 영속, descriptionTagList 는 header/print 가 렌더. **write-but-no-read-back** → 저장 후 (재)로드 시 초기 기본값으로 되돌림. descriptionTitle/Content 는 hydrate 하면서 tag list 만 drop 하는 명백한 불일치.

### EXT-DIFF-B-001 (medium · bug) — `serverSortParam` falsy-0 가드가 columnField===0 시 서버 정렬 누락 (정본은 null-check)
- 파일: `fs-external-data-viewer/src/widgets/grid-table/hooks/useTableView.ts:106`
- 포크 `if(columnField && direction)`, 정본 `?? {columnField:null,direction:null}` + `if(columnField!==null && direction!==null)`. columnField 는 서버 유래 number(columnId), 0 은 타입상 유효하고 정본 maintainer 의 `!==null` 가드는 0 도달성 함의. truthy 가드면 columnField===0 컬럼 정렬 시 sort param undefined → 미정렬 반환하나 헤더는 active 표시. rowFiltering.ts 자체 패턴과도 불일치. 0 실제 도달성 미확정이라 medium.

### EXT-DIFF-B-002 (low · bug) — `globalMinSeqRef.current` 를 render 본문에서 할당 (sibling 전용 파일)
- 파일: `fs-external-data-viewer/.../useTableViewServerPaging.ts:44`
- 앞 두 ref bridge 는 useEffect+cleanup 인데 globalMinSeqRef bridge(L44-47)만 render 본문 직접 할당, effect/cleanup 없음. StrictMode 이중 호출/concurrent 재렌더 시 다회 실행, 언마운트 시 미리셋 → 소비 gridUtil 에 stale globalMinSeq 고정. 파일 자체 관례와 불일치. canonical 카운터파트 없는 sibling 전용.

---

## UI/UX 회귀

### UX-5-001 (high · uiux) — sub 뷰어가 frozen 컬럼 마킹 유지하면서 고정 메커니즘 제거 → 고정 안 됨
- 파일: `fs-sub-data-viewer/src/widgets/grid-table/components/GridBody.tsx:245`
- 정본은 `computeFrozenLayout` + `<FrozenLayoutContext.Provider>` 로 DataCell 이 sticky offset 적용. sub 포크는 import 자체 제거, grid-table 전역 FrozenLayout 참조 0. 그러나 **클린 제거가 아님**: `customColumnGenerator.ts:46` 이 여전히 `frozen:'start'` 설정, 타입에도 `frozen?` 유지. 컬럼은 frozen 지정되나 렌더 레이어에 고정 메커니즘 없음 → 가로 스크롤 시 고정 의도 컬럼이 함께 스크롤되어 사라짐.

### UX-5-002 (low · uiux) — 그룹행 select-all 체크박스 제거 (양 형제) — **검증 하향: 일관 불일치가 아니라 기능 제거**
- 파일: `fs-sub-data-viewer/.../grid-body/GroupHeader.tsx:51` (external 동일)
- 정본 GroupHeader 는 그룹 선택 체크박스(onSelectGroup/getGroupSelectionState, indeterminate)를 렌더. 양 형제가 체크박스 블록·import·indeterminate 전부 제거하고 ChevronRight 만 남김. **검증 정정**: SelectionStateContext 에서 onSelectGroup/getGroupSelectionState 도 양 형제가 함께 제거함 → API-존재-컨트롤-부재 불일치가 아니라 **일관된 그룹선택 기능 제거**. 따라서 high→low 하향. 단 행 단위 선택은 유지되므로 '그룹 전체 선택' 어포던스 부재는 선택 모델 축소로 남음(의도 여부 마스터 확인 권고).

### UX-5-003 (medium · uiux) — 그룹행 로딩 스피너(Loader2) 제거 (양 형제) → 그룹 fetch 중 피드백 없음
- 파일: `fs-sub-data-viewer/.../grid-body/GroupHeader.tsx:51` (external 동일)
- 정본은 isLoading prop 으로 그룹 행 lazy fetch 중 Loader2 스핀 표시. 양 형제가 isLoading prop·Loader2 import 제거, 항상 정적 ChevronRight → 접힌 그룹 펼칠 때 서버 fetch 진행 피드백 없음(인지 버벅임).

### UX-5-004 (low · a11y) — 집계 진행 어포던스가 `<Tooltip>` → bare `<div title=>` 로 다운그레이드 (양 형제)
- 파일: `fs-sub-data-viewer/.../grid-body/GroupHeader.tsx:62` (external 동일)
- 정본은 공유 `<Tooltip>` 래핑. 양 형제가 native `title` 로 교체 → 느린 표시 지연, 비일관 스타일, 키보드/포커스 미노출. 소소하나 일관/a11y 회귀.

### UX-5-005 (medium · uiux) — GroupHeaderRow 가 showIdColumn 무시 → 헤더/본문 정렬 어긋남 — **검증 정정: external 전용**
- 파일: `fs-external-data-viewer/src/widgets/grid-table/components/grid-header/GroupHeaderRow.tsx:36` *(원 보고 fs-sub-data-viewer → 검증 결과 external 전용으로 정정)*
- 정본은 showIdColumn=false 시 ID 컬럼을 필터 후 그룹 세그먼트 빌드. **검증 정정**: 이 drop 은 external 에만 존재(sub 는 정본과 동일, 필터 유지). ID 컬럼 숨김 토글 시 본문은 빼지만 그룹 헤더 밴드는 ID 세그먼트 유지 → 가로 정렬 어긋남. 수정 대상은 external 파일.

### UX-5-006 (medium · uiux) — GroupHeaderRow 가 drag 컬럼 폭 무조건 차감 → read-only 모드 정렬 어긋남 — **검증 정정: external 전용**
- 파일: `fs-external-data-viewer/.../grid-header/GroupHeaderRow.tsx:30` *(원 보고 fs-sub-data-viewer → 검증 결과 external 전용으로 정정)*
- 정본은 `isWriteMode(mode) && !isReadOnly` 일 때만 drag 핸들 폭 예약. **검증 정정**: external 만 useReadOnly/isWriteMode 가드 제거하고 무조건 예약(sub 는 정본과 동일 유지). read-only sub-grid(주 용도)에서 본문엔 drag 컬럼 없는데 그룹헤더는 폭만큼 우측 시프트 → 헤더가 본문과 한 컬럼폭 어긋남. 수정 대상은 external 파일.

### UX-5-007 (medium · uiux) — external 뷰어 ServerPagingOverlay 가 isLoadingMore 대신 isLoading 키잉 → 모든 로드에 '추가 로딩' 오버레이
- 파일: `fs-external-data-viewer/.../ServerPagingOverlay.tsx:51`
- SUB-DIFF-B-001(훅 순서 크래시)과 별개의 상태-의미 분기. 정본은 다음 페이지 fetch 전용 `isLoadingMore` 로 GridBuildingAnimation·하단 오버레이 구동. external 은 generic `isLoading`(필터/정렬/새로고침 등 모든 fetch 에 true)을 `!isInitialLoad` 게이트만으로 사용 → '행 추가 로딩' 오버레이가 페이지 append 아닌 전체 리로드에도 표시(오레이블). sub 형제는 isLoadingMore 유지 → 형제 간에도 분기.
