# 정본 뷰어 (fs-data-viewer) — 버그 클래스

> 스코프 DCV-1~7 (239k LOC, 1,548 파일). 패키지가 매우 hardened(BUG-###/PHASE-NN/HOTFIX 마커 다수)하여 발견은 적으나 일부는 데이터 손실급. 검증 VS-3: 전건 substance CONFIRMED, 일부 라인번호 ADJUST.

---

## DCV-2-001 (high · bug) — `createDateValue` toISOString 날짜 off-by-one (KST 등 UTC+ 존)
- 파일: `packages/fs-data-viewer/src/shared/lib/cell-value.utils.ts:249` *(검증 라인 조정: 249=return, 원 보고 248=선언)*
- `date.toISOString().split('T')[0]` 가 UTC 포맷 → UTC+9 로컬 자정/저녁 Date 가 전날로 밀림. 사용자가 2025-12-09 선택 시 '2025-12-08' 저장 가능. 형제 `format-date.utils.ts` `formatDate()` 는 로컬 getter 사용(올바름). public lib export. → 3개 포크 복제(SYS-001).

## DCV-2-002/003/004 (medium · bug) — 가상화 셀 렌더러 비동기 stale-closure 레이스 (File/Image/Connection)
- 파일: `.../renderers/file/FileRenderer.tsx:36`, `.../image/ImageRenderer.tsx:36`, `.../ConnectionRenderer.tsx:70`
- `onFileLoad(...).then(setItems)` / `resolveConnectionValues(...).then(setResolvedValues)` effect 가 cancel 플래그·cleanup 없음. 가상화 뷰(kanban/calendar/gantt)에서 컴포넌트 인스턴스가 셀 간 재활용 → 이전 셀의 in-flight promise 가 resolve 되어 다른 셀의 파일/이미지/라벨을 표시, 또는 언마운트 후 setState. 세 렌더러가 copy-paste 형제로 동일 버그(클래스 체계성 확인).
- 검증: 3건 모두 CONFIRMED.

## DCV-1-001 (medium · bug) — `checkCircularReferences` DFS 가 사이클 검출 시 recursionStack 누수 → 가짜 순환참조
- 파일: `packages/fs-data-viewer/src/entities/grid/integrity/formula-checks.ts:420`
- 내부 dfs 가 clean-exit(L449)에서만 `recursionStack.delete` 하고, 사이클 발견 early-return(L426-429/443-445)에서는 미삭제. 첫 사이클 후 경로상 노드가 스택에 영구 잔존 → 이후 루트의 dfs 에서 무관 컬럼이 CIRCULAR_REFERENCE 로 오탐, cyclePath 도 garbage. 실 사이클 1개 + 그 멤버 참조하는 무관 수식 컬럼 존재 시 가짜 추가 에러.

## DCV-3-001 (high · bug) — 범위 Backspace 삭제가 columnField 를 인덱스 아닌 값 범위로 비교 → 오삭제·데이터 손실
- 파일: `packages/fs-data-viewer/src/features/grid/hooks/grid-clipboard/useClipboardHandlers.ts:543`
- `handleDeleteCells` Case 2 가 `cell.columnField >= minCol && <= maxCol`(raw 값)으로 선택. 같은 파일 다른 곳은 의도적으로 `columnModelList.findIndex` 인덱스 비교(L314 주석 'R4 인덱스 기반'). columnField 는 id(위치 아님, 재정렬/삽입/삭제로 비연속) → 다중 컬럼 범위 삭제 시 선택 안 한 컬럼 삭제 또는 선택한 것 누락. `saveBatchChanges` 로 서버에도 반영되는 **무음 데이터 손실**.

## DCV-3-002 (medium · bug) — `flushChanges` 에러 경로가 in-flight 추가 변경을 복구 핸들 없이 폐기
- 파일: `packages/fs-data-viewer/src/features/data-viewer/hooks/useSaveFunctions.ts:154`
- 저장 실패 시 `pendingChangesRef.current = []`(BUG-402, 의도적). 결함은 snapshot(L121) 이후 await 중 추가된 변경이 wipe 에 휩쓸리고 `onSaveError` 는 snapshot 만 받음(L157) → 시도조차 안 된 편집이 retry·표면화 없이 소실. 성공 경로는 snapshot 멤버십 필터로 보존(L136-138)하나 에러 경로는 전체 ref clear.

## DCV-4-001 (high · bug) — 잘못된 이메일 입력 시 빈 문자열 저장 → 이전 값까지 파괴
- 파일: `packages/fs-data-viewer/src/widgets/cell-renderers/FsGridEmailCellRenderer/useEmailCellHandlers.ts:30`
- `validateAndSave()` 가 '' 또는 emailRegex 일치 시만 저장, 그 외엔 `saveCellValueWithChange({newValue:''})` + `setValue('')`. malformed 이메일 입력 후 blur/Enter/Tab 시 무경고 빈값화 + 기존 유효값 폐기 = 무음 데이터 손실. percent 셀은 invalid 시 이전 값 복원(올바름)과 대조.

## DCV-4-002 (medium · bug) — D-Day 가 UTC 자정 파싱 vs 로컬 today 비교 → 음수 UTC 존 off-by-one
- 파일: `.../FsGridDeadlineCellRenderer/deadlineUtils.ts:68`
- `new Date(date)`(bare 'yyyy-MM-dd' → UTC 자정) 후 로컬 getFullYear/Month/Date 추출, 로컬 today 와 비교. UTC- 존에서 전날로 밀려 D-Day/연체 경계 하루 오차. 캘린더는 로컬 formatDate 로 기록 → 왕복 불일치. KST 무영향(누락 사유).

## DCV-4-003 (medium · bug) — percent `handleChange` 가 다중 소수점 허용 → '5.5.5' 그대로 저장
- 파일: `.../FsGridPercentCellRenderer/usePercentCellHandlers.ts:113`
- `[0-9.]` 외만 제거하여 '5.5.5' 통과. `parseFloat('5.5.5')===5.5`(0~100 범위)라 raw '5.5.5' 저장 → 검증 숫자와 저장 문자열 불일치. number 셀은 추가 점을 `parts.slice(1).join('')` 로 병합(올바름), percent 만 누락.

## DCV-5-001 (high · bug) — `useUserCellCounts` 가 존재하지 않는 필드(userId/cells) 읽음 → 모든 카운트 항상 0
- 파일: `.../dashboard/widgets/user-insight/lib/useUserCellCounts.ts:35`
- `rows: PreprocessedRow[]`(={rowField, cellMap})를 `as unknown as {userId?,cells?}` 로 캐스팅 후 `r.userId !== userId`(항상 undefined→항상 skip), `r.cells?.[...]`(항상 undefined) 읽음. 결과 UserCellCountMap 전부 0 → UserListSettings 배지 영구 0 표시. 올바른 로직은 cellMap + user 컬럼 스캔(aggregateUserScopedRows 참조). double-cast 가 타입 구멍 은닉(SYS-006 사례).

## DCV-5-002 (medium · bug) — sub-grid rowSeq 변경이 parentRowField 를 subGroupId 로 태깅 (reorder 경로는 subGridField 사용)
- 파일: `.../widgets/fs_grid_sub/hooks/useSubGridRendering.ts:179`
- `convertChangesToSubGrid(changes, parentRowField)` 가 2번째 인자를 `subGroupId` 로 직접 전달→`createSubGridRowSeqChange(subGroupId,...)`. 형제 reorder 경로(`useSubGridModel.handleRowReorder` L661-666)는 `subGridField` 전달. 두 경로가 subGroupId 의미 불일치 → 서버가 sub-grid id 로 키잉 시 batch 행삭제의 seq 부분 오라우팅/거부 가능. 주석이 이 변환은 batch 행삭제 거부 방지용이라 명시 → 잘못된 id 가 그 수정을 무효화.

## DCV-6-001 (high · bug) — 캘린더 같은날 카드 재정렬이 음수 UTC 존에서 무음 실패
- 파일: `.../widgets/calendar/detail-panel/calendarReorderHelper.ts:41`
- `moveCardInDay` 가 `new Date(substring(0,10))`(UTC 자정)으로 같은날 필터 후 `formatDate(parsed) === dateKey`(로컬) 비교. UTC- 존에서 `new Date('2026-05-28')`=로컬 05-27 → never equals → sameDayRows 가 카드 제외 → `[]` 반환 → 위/아래 재정렬 무음 no-op. KST(UTC+9)에서만 동작. 코드베이스 자체 관례(parseDate 가 'T00:00:00' 부착해 로컬 파싱 강제)도 위반. *(검증: 영향은 데이터 손실 아닌 broken reorder no-op — high 방어 가능하나 경계.)*

## DCV-7-001 (medium · bug) — 드래그 재정렬 아래로 드롭 시 off-by-one
- 파일: `.../widgets/cell-style-dialog/useDragHandlers.ts:~62-67` *(검증 라인 조정: 원 보고 284 오류, 실제 파일 75줄)*
- `handleDrop` 이 draggedIndex 에서 splice 제거 후 미보정 `index` 에 삽입. 아래로 드래그(draggedIndex<index) 시 제거로 인덱스 1 시프트 미보정 → 한 칸 일찍 안착. 형제 SelectOptionsSettingsWrapper 는 `dragOverIndex>draggedIndex?-1:` 보정함.

## DCV-7-002 (medium · bug) — `showToast` 가 미해제 setTimeout 예약 → 이전 타이머가 새 토스트 조기 닫음 + 언마운트 cleanup 없음
- 파일: `.../widgets/dialogs/useToast.ts:30` *(검증 라인 조정: 원 보고 940 오류, 실제 파일 39줄)*
- 매 showToast 가 새 `setTimeout`(isOpen=false) 시작하나 이전 타이머 저장/clear 안 함. 연속 토스트 시 이전 타이머가 새로 표시된 토스트를 조기 종료. 언마운트 시도 미해제 → 언마운트 컴포넌트 setState. useRef/clearTimeout 가드 전무.

## DCV-7-003 (medium · bug) — `new Date('yyyy-MM-dd')` UTC 자정 파싱이 음수 오프셋 존에서 하루 밀림
- 파일: `.../widgets/batch-input-dialog/batch-delete/useDatePickerOverlay.ts:63` *(검증 라인 조정: 원 보고 771 오류, 실제 파일 185줄; L110/127 동일 패턴)*
- `open()` 의 `new Date(value)`(date-only→UTC 자정) vs 캘린더 그리드/formatDate 로컬 getDate. UTC 서쪽 존에서 전날 하이라이트/사전선택 → batch-delete created_at 범위 필터 오일. DatePickerInput.tsx 도 동일 패턴(in-range 밴드).

---

### 제외/하위임계
serverRowTransform recentlyDeleted/version/abort(잘 방어됨), useGridHistory undo/redo setTimeout(ref 기반 건전), print JSON.parse(try/catch), parseInt(NaN 가드), rowModelCache 싱글톤(올바름, perf-only), formula bold/code 정규식 중첩(영향 불명) 등.
