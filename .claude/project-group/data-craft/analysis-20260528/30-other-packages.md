# 기타 패키지 — fs-api / fs-data-link / fs-file-attachment

> 스코프 PKG-A(fs-api/fs-data-link) · PKG-B(relation-builder/file-attachment/explorer×3/shared). explorer 3종은 near-clone(분기는 의도적 적응 또는 Pass-3 계약 사안). 검증 VS-2: 전건 CONFIRMED, PKG-A-006 파일경로 ADJUST.

---

## fs-api (HTTP/토큰 레이어)

### PKG-A-001 (high · bug) — `handleTokenExpired` 가 갱신 후 retry 실패 시 유효 토큰 폐기 + 강제 로그아웃
- 파일: `packages/fs-api/src/core/tokenRefresh.ts:107`
- 단일 try 가 `refreshAccessToken()` AND `retryFn(newAccessToken)` 둘 다 감쌈. 갱신 성공 후 retry 가 임의 사유(500·일시 네트워크·검증)로 실패하면 catch 가 `clearTokens()`+`onAuthFailure()` → 방금 갱신한 유효 토큰 폐기, 인증은 멀쩡한데 로그인으로 리다이렉트. catch 가 refresh 실패와 retry 실패를 구분해야 함.

### PKG-A-002 (high · bug) — AbortError·일시 네트워크/타임아웃을 토큰 만료로 오분류 → 불필요 refresh/로그아웃
- 파일: `packages/fs-api/src/core/client.fetch.ts:159` (및 :234)
- `isNetworkOrTimeoutError()` 가 TypeError·AbortError 에 true. 잡힌 네트워크/타임아웃/abort 가 `handleTokenExpired()` 로 라우팅. (1) 사용자 취소(언마운트·디바운스 검색 cancel; InputSection cleanup 이 매 언마운트 abort)가 '토큰 만료'로 처리되어 가짜 refresh, (2) 진성 네트워크 단절 시 refresh fetch 도 실패 → PKG-A-001 경로로 로그아웃. *(검증: 동일 패턴이 `interceptor.ts` L171-196 에도 존재. 원 보고의 'client.ts:174,250' 교차참조는 interceptor.ts 로 정정; 주 인용 client.fetch.ts:159 는 정확.)*

### PKG-A-006 (medium · bug) — createFsApi 에러 경로가 `response.json()` 직접 파싱 → 비-JSON 에러 본문 폐기 — **검증 정정: 파일은 interceptor.ts**
- 파일: ~~client.ts:72~~ → **`packages/fs-api/src/core/interceptor.ts:71-83`** (검증 ADJUST: client.ts 는 70줄로 executeFetch 없음)
- `executeFetch` 가 `!ok` 경로에서 `response.json().catch(()=>({}))` 호출. 비-JSON 에러 응답(plain-text 게이트웨이·HTML 502)이 무음 `{}` 가 되고 throw 되는 ApiException 이 실제 서버 텍스트 대신 generic 'API request failed' 메시지 운반. client.fetch.ts(text() 우선 후 JSON 시도)와 불일치. createFsApi 팩토리로 만든 모든 소비자의 에러 진단 정보 손실.

## fs-data-link

### PKG-A-003 (medium · bug) — `saveWorkspace` 가 data 배열 빈 경우 VERIFIED 처리 (`[].every === true`)
- 파일: `packages/fs-data-link/src/entities/data-source/model/store.ts:106`
- `isVerified = apiData.every(...)/protocolData.every(...)`. 빈 배열의 every 는 true → 빈/미검증 소스가 저장 시 status:'VERIFIED' → WorkspaceSection 의 '적용하기' 활성. 사용자가 빈 미검증 소스를 적용 가능. length>0 가드 필요.

### PKG-A-004 (medium · bug) — `selectedEndpointId` 가 data[0] 으로만 초기화, data prop 변경 시 stale
- 파일: `packages/fs-data-link/src/widgets/api-workspace/ui/ApiWorkspace.tsx:17`
- `useState(data[0]?.id)` 1회 시드, data prop 변경 시 미조정. WorkspaceSection 이 source id 키 없이 `<ApiWorkspace data=...>` 렌더 → 다른 API 소스 전환 시 prop in-place 교체(remount X) → selectedEndpointId 가 새 data 와 불일치 → 상세 패널 빈 'noData'. 선택 endpoint 삭제 시도 동일. 수정: data 변경 시 선택 reset/reconcile.

### PKG-A-005 (medium · bug) — `selectedCommandId` 동일 stale 클래스
- 파일: `packages/fs-data-link/src/widgets/protocol-workspace/ui/ProtocolWorkspace.tsx:15`
- PKG-A-004 와 동일. data[0] 1회 시드, 미조정. 프로토콜 소스 전환 시 '명령어를 선택하세요' 표시(명령 존재함에도).

## fs-file-attachment

### PKG-B-001 (high · bug) — 다중 파일 업로드 진행률이 첫 파일 후 100% 점프
- 파일: `packages/fs-file-attachment/src/useFileUpload.ts:133`
- `onProgress` 가 `updateProgress(completedCount-1, 1, 1)` 로 ever-changing 인덱스에 `{loaded:1,total:1}` 기록. `useUploadProgress` 의 totalProgress=sum(loaded)/sum(total)*100 → 첫 파일 완료 후 맵에 {1,1} 단일=100%. 2개 이상 업로드 시 진행바가 업로드 중에도 100% 표시. 의도된 파일별 바이트 진행(fileIndex 키잉)은 전달 안 됨.

### PKG-B-002 (medium · bug) — 비격리 업로드 실패 시 고아 임시 파일 행 잔존
- 파일: `packages/fs-file-attachment/src/useFileUpload.ts:160`
- tempFiles(음수 id placeholder)가 parallelUpload 전 fileList 에 추가. parallelUpload 는 onFileError 로 파일별 에러 격리하나, 외부 try 가 그 전/밖에서 throw(parallelUpload 자체 reject·동기 throw) 시 외부 catch(~L160)가 isLoading/isUploading 만 리셋, temp placeholder 미제거 → 음수 id phantom 'uploading' 행 잔존. toggleSelectAll 이 id>0 필터라 UI 로 제거 불가.

### PKG-B-003 (medium · bug) — `toggleSelectAll` 이 length-only 동등성으로 전체선택/해제 판단
- 파일: `packages/fs-file-attachment/src/useFileSelect.ts:41`
- `prev.length === selectableFiles.length` 로 판단 → '전체 선택'과 '우연히 같은 크기의 부분 선택'을 혼동. fileList 변이(미선택 파일 삭제·temp 행 교체) 후 부분 부분집합 길이가 우연히 일치하면 전체선택 대신 전체해제. set 멤버십 비교가 올바름.

---

### 검증/양호
fs-api/api/* 대부분 thin snakeToCamelDeep 래퍼(null 가드 일관, 결함 없음). relation-builder zustand 스토어/검증·fs-shared TimerManager 양호. explorer 3종 분기는 의도적 적응 또는 Pass-3 계약 사안(50 문서 참조).
