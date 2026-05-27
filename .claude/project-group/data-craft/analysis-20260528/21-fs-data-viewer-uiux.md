# 정본 뷰어 (fs-data-viewer) — UI/UX

> 스코프 UX-2(셀 편집·다이얼로그) · UX-3(대안 뷰·툴바) · UX-4(상호작용·relation·업로드). 뷰어는 색을 var()/semanticColors+인라인으로 흘리므로(412 tsx 중 `dark:` 단 2건) 하드코딩 light 색은 진성 회귀.

---

## UX-2-001 (high · uiux) — `FsGridCustomDialog` 가 await 전에 닫혀 로딩 미표시·에러 무음 삼킴
- 파일: `.../widgets/dialogs/FsGridCustomDialog.tsx:33`
- `handleConfirm()` 이 `onClose()` **먼저**, 그다음 `setIsLoading(true)`, `await onConfirm()`. onClose 가 다이얼로그 언마운트 → (1) 버튼 내 Spinner(JSX L81-89)가 절대 안 보임(느린 작업 피드백 0), (2) try/catch 없이 finally 만 → onConfirm reject 시 완전 무음(에러 토스트·재오픈 없음, 사용자는 성공으로 오인). 형제 `FsGridAlertDialog` 는 async 동안 열어두고 Spinner·catch·finally onClose 로 올바름. 뷰어 전반 confirm 흐름의 범용 다이얼로그라 영향 광범.

## UX-2-002 (medium · uiux) — 무결성 다이얼로그 핸드롤 포털: ESC 닫기·포커스 트랩·포커스 복귀 없음 (키보드 트랩)
- 파일: `.../widgets/dialogs/IntegrityCheckDialog.tsx:70`
- 공유 semantic Dialog 대신 자체 createPortal. backdrop 클릭(마우스 전용)+X 버튼만 있고 keydown 핸들러 없음 → Escape 미작동(타 다이얼로그 전부 ESC 지원). 오픈 시 포커스 미이동, Tab 미트랩, 닫을 때 트리거 포커스 미복귀. 키보드 사용자가 닫을 키 없음. Radix 기반 공유 Dialog 는 이 모두 무료 제공.

## UX-2-003 (medium · uiux) — 셀 스타일 다이얼로그 핸드롤 포털: ESC·포커스 관리 없음
- 파일: `.../widgets/cell-style-dialog/FsGridCellStyleDialog.tsx:43`
- 수동 createPortal(900x500), backdrop+X 만, keydown 없음 → ESC 미작동(형제 long-text EditDialog/ColorPickerDialog 는 ESC 처리). 오픈 포커스·Tab 트랩·복귀 없음. 드래그 재정렬 행·색 컨트롤 호스팅이라 키보드 닫기 누락 두드러짐.

## UX-2-004 (medium · uiux) — 핸드롤 포털 다이얼로그군이 bg-white/text-gray-* 하드코딩 → 다크모드 회귀
- 파일: `.../widgets/dialogs/IntegrityCheckDialog.tsx:74` (외 4파일 집계)
- 자체 createPortal 표면을 그리는 다이얼로그군이 공유 Dialog 의 dark-aware 토큰(bg-card/text-foreground/text-muted-foreground/bg-muted) 대신 `bg-white`/`border-gray-200`/`text-gray-900/700/500`/`bg-gray-50`/`hover:bg-gray-100` 하드코딩. 다크모드에서 밝은 흰 패널+회색 텍스트. 영향 파일(패널 chrome): IntegrityCheckDialog, long-text/EditDialog, color-picker/ColorPickerDialog, FsGridCellStyleDialog, FsGridAlertDialog(affected-fields 목록). 1건으로 집계(패딩 회피).

## UX-2-005 (low · uiux) — 컬럼 상세 패널 헤더 bg-gray-50/text-gray-900/500 하드코딩
- 파일: `.../widgets/view-column-manager/ColumnDetailPanel.tsx:24`
- info 헤더가 dark-aware 토큰 대신 light 색. 사이드 패널·드롭다운 컬럼 메뉴 양쪽 렌더라 다크모드에서 light 회색 블록. UX-2-004 와 별개(비-다이얼로그 위젯군).

## UX-3-001 (high · uiux) — 가이드 마크다운 표가 light 회색/흰색 하드코딩 → 다크모드 판독 불가
- 파일: `.../widgets/guide/components/ContentRenderer.tsx:65`
- 가이드/문서 뷰어(v001.503.0 개편)의 1차 읽기 표면. 표 렌더가 `border-gray-200`/`bg-gray-50` 헤더/`text-gray-700` 셀/zebra `bg-gray-50/50` vs `bg-white`/`text-gray-600` 본문 하드코딩, var() 미경유. 다크모드에서 흰 블록+짙은 회색 텍스트로 저명암. 가이드 다이얼로그 셸들(GuideViewerDialog/DocsViewerDialog/GuideSelectionDialog)도 동일 패턴이나 표 본문이 최악(주 읽기 콘텐츠).

## UX-3-002 (high · uiux) — 차트 에러 복구 다이얼로그 light 하드코딩 → 에러 UI 다크모드 깨짐
- 파일: `.../widgets/dashboard/widgets/ChartErrorBoundary.tsx:155`
- 대시보드 위젯 throw 시 유일한 복구 어포던스(재설정/삭제). 설명 `text-gray-600`(L155), 재설정 버튼 `border-gray-300 bg-white text-gray-700`(L177), 삭제 `bg-red-500`(L187) 가 var()/DashboardTokens 미경유. 다크모드에서 설명 거의 비가시, 재설정은 흰 박스. 같은 파일 나머지는 DashboardTokens var() 사용이라 명백한 불일치. 이미 문제 발생 후 도달하는 표면이라 고영향.

## UX-3-003 (medium · uiux) — 툴바 '열관리' 버튼 onMouseLeave 가 primitiveColors.white 강제 → 다크모드 흰 버튼
- 파일: `.../widgets/data-viewer-header/HeaderActions.tsx:152`
- onMouseEnter=gray100, onMouseLeave=white 인라인 핸들러. className 은 `bg-background`(var())이나 imperative onMouseLeave 가 리터럴 white 로 덮어씀(클래스보다 우선). 다크모드에서 포인터가 떠나는 순간 흰 배경으로 스냅. 올바른 값은 'transparent'/토큰 복귀.

## UX-3-004 (medium · a11y) — 아이콘 전용 새로고침/저장 툴바 버튼에 접근명 없음
- 파일: `.../widgets/data-viewer-header/HeaderActions.tsx:194` (및 L221)
- 새로고침(RefreshCw)·저장(Save) 버튼이 텍스트·aria-label 없이 아이콘만. `<Tooltip>` 래핑되나 공유 Tooltip 이 aria-label/aria-describedby 미배선(컴포넌트에 aria 속성 grep 0) → 스크린리더는 이름 없는 'button'. t.common.refresh/t.header.saveTooltip 문자열 존재하므로 aria-label 추가가 표준 수정.

## UX-3-005 (medium · uiux) — 대시보드 위젯 설정 패널이 체계적으로 light 회색/흰색 하드코딩
- 파일: `.../widgets/dashboard/widget-settings/settings/LineChartSettings.tsx:156` (외 다수 집계)
- 라벨/입력/세그먼트 토글/드롭다운/리스트가 `text-gray-*`/`border-gray-*`/`bg-white`/`bg-gray-50`/세그먼트 `bg-blue-500 text-white` vs `bg-white text-gray-600` 하드코딩. widget-settings 트리 전반 패턴(LineChart/BarChart/Gauge/Card/UserList Settings, WidgetPreviewPane, WidgetTypeTabBar). 다크모드에서 흰 입력 박스+저명암 텍스트. 1건 집계.

## UX-3-006 (low · uiux) — fallback 로딩 스피너가 border-gray-300/border-t-blue-500 하드코딩
- 파일: `.../widgets/dashboard/DashboardGrid.tsx:502` (및 FsDashboard.tsx:1116)
- 타입별 애니메이션 없을 때 fallback 스피너 ring 색 하드코딩. 다크 대시보드에서 light 회색 원. backdrop 자체는 color-mix(var(--card)) 로 올바름이라 하위.

## UX-4-001 (medium · uiux) — relation-builder GroupSelector 가 dark 변형 전무 → 다크 다이얼로그에 light 패널
- 파일: `packages/fs-relation-builder/src/features/add-group/ui/GroupSelector.tsx:67`
- 패널 전체가 `bg-white border-gray-200`/`text-gray-900`/`text-gray-700` 등 `dark:` 카운터파트 없이. DesignerDialog(`dark:bg-gray-900`) 안에 렌더 → 다크모드에서 near-black 다이얼로그 위 흰 카드. 형제 컴포넌트(Sidebar/DataGroupCard/ColumnTable)는 dark 커버리지 보유 → 국소 회귀. grep 결과 이 패키지에서 dark 없는 유일 파일.

## UX-4-002 (medium · uiux) — ColumnTable 필드명 text-gray-700, dark 변형 없음 → 다크-온-다크 판독 불가
- 파일: `packages/fs-relation-builder/src/widgets/data-group-card/ui/ColumnTable.tsx:45`
- 컬럼 필드명 `<span class="text-gray-700">` 에 dark 텍스트색 없음. 같은 파일 다른 표면은 dark 커버리지 완비(헤드 `dark:bg-gray-700`, 선택행 `dark:bg-blue-900/30` 등) → 다크모드에서 행의 가장 중요한 콘텐츠(필드명)가 어두운 배경 위 어두운 회색으로 사실상 판독 불가. 파일 자체 관례 대비 국소 회귀.

## UX-4-003 (low · a11y) — 색상 스와치 버튼에 접근명 없음 (ColorPickerBase + PaletteGrid)
- 파일: `packages/fs-data-viewer/src/shared/ui/ColorPicker/ColorPickerBase.tsx:66`
- 각 스와치가 `style={{backgroundColor}}` 만, 텍스트·aria-label·title 없음 → 스크린리더는 'button'만, 선택 상태도 시각(`ring-2`)만. 형제 PaletteGrid(L42-54)도 동일(ColorPickerRenderer/ButtonSettingsDialog/ColorPickerDialog 사용). aria-label(색값)+aria-pressed/role 필요. 그리드 컨테이너도 list/group role 없음.

---

### 검증/양호
배치-삭제 파괴 흐름은 showConfirm() 확인 후 실행(양호). kanban 드래그-취소(Esc/dragend 리스너 존재). text-muted-foreground 사용(var 기반, dark-safe).
