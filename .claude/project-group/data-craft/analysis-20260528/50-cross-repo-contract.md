# 크로스 레포 — FE↔서버 계약 / import 무결성 / 상태 결합 (Pass 3)

> 208개 서버 라우트 + 225개 FE API 호출 사이트를 스캐폴딩으로, per-handler 정독으로 드리프트 탐지. 검증 VS-5: 6건 전부 CONFIRMED(라인 미세 drift 만).

---

## 계약 드리프트 (FE↔서버)

### P3-CONTRACT-001 (high · contract) — orphan fetcher: `renameGroup` PATCH 가 존재하지 않는 서버 라우트로 → 무음 404
- 파일: `data-craft/packages/fs-api/src/api/externalData.ts:205`
- `externalDataApi.renameGroup()` 이 `PATCH /api/external-data/groups/:groupId/rename` 호출하나 `data-craft-server/src/routes/externalData.ts` 에 /rename 라우트 없음, externalData.controller 에 rename 핸들러 없음. **라이브 fetcher**: inputDataGroupApi.renameGroup → useRenameInputDataGroup → InputPropertiesEditor.tsx:110 + Input.widget.tsx:122(입력 위젯 데이터 그룹 rename 흐름)에 배선. 매 rename 시도가 Express 5 fall-through 404 → 사용자에게 무음 실패.

### P3-CONTRACT-002 (medium · contract) — request-shape: `subGridApi.updateConfig` 가 rowDescriptions/columnGroupModelList 광고하나 컨트롤러가 무음 drop
- 파일: `data-craft/packages/fs-api/src/api/subGrid.ts:71`
- updateConfig config 타입에 optional rowDescriptions/columnGroupModelList 포함하나 `updateSubGridConfigController`(server subGridData.controller.ts:110)는 6개 명명 필드만 destructure → 두 필드는 읽히지도 영속되지도 않고 무에러 폐기. 메인 뷰어 config 경로(viewer.service.ts)는 처리하므로, 이 래퍼로 보낸 sub-grid 컬럼그룹/행설명 config 는 무음 미저장. 현재 라이브 caller 없어 latent 이나 타입 계약이 향후 무음 손실 초대.

## 상태/결합 드리프트

### P3-COUPLING-001 (high · cross-file) — `notifyRowAdded` 가 grouped `groups` 상태 미동기 → 그룹핑 모드에서 추가 행 비표시 + stale rowCount
- 파일: `packages/fs-data-viewer/src/features/grid/hooks/server-paging/useServerPagingOrchestrator.ts:531`
- 서버 페이징 오케스트레이터가 두 결합 상태 소유: flat rowCache/totalRows + grouped `groups`(그룹 표시 행은 groups[*].rows). `notifyRowDeleted`(#169)는 setGroups 로 그룹에서 삭제·rowCount 감소(L613-633), `updateCellInLoadedRow`(HOTFIX-001)도 setGroups(L656~). 그러나 `notifyRowAdded`(L531-567)는 setGroups 없음, grouping-aware 도 아님(deps=[loadPage]). insertedRows 경로는 rowCacheRef+totalRows+rowMapVersion 만 변이 후 page 0 reload 없이 반환. 결과: row-grouping 모드(isGroupingActive)에서 행 추가가 flat cache·카운터만 갱신, groups[*].rows·rowCount 는 stale → 새 행이 그룹에 안 보이고 카운트 틀림(무관 full reload 전까지). **이것이 메모리의 grouped-store sync 결함 클래스의 add-side(delete-side 는 패치됨, add-side 미패치, 여전히 open).** *(검증: setGroups 호출 라인 656; 원 보고 668 미세 drift.)*

### P3-COUPLING-002 (medium · cross-file) — `useExternalData` metaOnly 가 full getGroupData 후 rows 폐기 — 명칭/동작 + 형제 useSubGridData 와 분기
- 파일: `packages/fs-external-data-viewer-explorer/src/hooks/useExternalData.ts:71`
- metaOnly:true 는 '메타데이터만 로드(rowModelList 빈 배열, 서버 페이징용)'로 문서화(L21-29)되나, metaOnly 분기(L71-77)가 `externalDataApi.getGroupData(groupId)`(전체 컬럼+전체 행 반환)를 호출 후 `{...data, rows:[]}` 로 행을 버림 → 서버가 초기 로드에 전체 행 materialize·전송, metaOnly/서버페이징 목적 무효(메모리/지연/페이로드 동일). 형제 `useSubGridData`(L68-75)는 동일 metaOnly 계약을 `subGridApi.getGroup`(메타 전용 엔드포인트)+subGridMetaToViewerModel 로 **올바르게** 처리. external 용 메타 엔드포인트(`externalDataApi.getGroup`, GET /api/external-data/groups/:groupId)도 존재하나 미사용. 동일 'metaOnly' 계약을 구현한 두 형제 훅이 분기. *(검증: useExternalData 자체 docstring 이 full-fetch-then-discard 를 의도로 기술 — 명칭/동작 불일치는 다소 약하나 형제 분기·서버페이징 목적 무효 논점 유효.)*

## import 무결성

### P3-IMPORT-001 (block · cross-file) — fs_api stale dist: `GeneralDataGroupListItem` 가 dist/index.d.ts 에 부재 → tsc 빌드 실패
- 파일: `src/entities/input-data-group/api/inputDataGroupApi.ts:2`
- 앱이 `import type { GeneralDataGroupListItem } from 'fs_api'`. 심볼은 `packages/fs-api/src/index.ts:282` 에 export 되나 package.json `types` 가 가리키는 `dist/index.d.ts` 에 없음. **이중 resolution 결함**: vite dev 는 alias(fs_api→src) 로 통과, 프로덕션 타입체크(`tsc -b`/`tsc -p tsconfig.app.json`)는 dist/index.d.ts 로 resolve → TS2305 실패. dist(2026-05-27 17:58 빌드)가 src(2026-05-28 00:15 편집)보다 stale 한 것이 근본. 메모리 `feedback_data_craft_lint_gate_root_app.md` 의 실패 클래스. **수정은 앱 코드가 아니라 `pnpm --filter fs_api build`.** *(검증: export 라인 282, 원 보고 ~290 미세 drift.)*

### P3-IMPORT-002 (block · cross-file) — fs_api stale dist: `SubDataViewerGroupListItem` 가 dist/index.d.ts 에 부재 → tsc 빌드 실패
- 파일: `src/features/viewer/lib/connectionCallbacks.ts:7`
- `import type { UserForm, SubDataViewerGroupListItem } from 'fs_api'` 중 `SubDataViewerGroupListItem`(src/index.ts:303 export)가 dist 부재. 함께 import 한 `UserForm` 은 dist 존재 → 그 줄 전체가 아닌 한 심볼만 미해결. P3-IMPORT-001 과 동일 원인(stale dist) → 동일 재빌드로 두 finding 동시 해소.

> circular dependency: 없음(cross-package edge 가 깨끗한 DAG). unused public export: explorer/viewer 가 multi-consumer 라이브러리 API 라 false-positive 회피 위해 미보고.
