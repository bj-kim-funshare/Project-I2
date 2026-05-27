# 심각도별 요약

> 총 **78건 actionable** (어드바이저 5 + 서브에이전트 5 검증 후, SYS-003 benign 제외). critical 0건. 전체 검증에서 **완전 반증 0건**.

## 🔴 최우선 콜아웃 — 지금 사용자를 막고 있을 가능성이 가장 높은 결함

**SRV-A-001 — 빌더 편집 권한 fail-closed 잠금 (서버, high).**
`builder.ts` 의 page/form/widget 편집 라우트가 `permissionCheckMiddleware('design_page_edit')` 를 `forceIncludeAuth` 없이 붙여, 기본 light-auth 경로에서 `req.user` 가 `undefined` → 소유자(owner)·편집자조차 `PERMISSION_DENIED` 로 거부됩니다. FE 가 우연히 `?includeAuth=true` 를 보내야만 통과. 같은 파일의 settings CUD 라우트, roles.ts, auth.ts, subscription.ts 등 **다른 모든 권한 라우트는 forceIncludeAuth 를 짝지어 사용**하므로 의도가 아니라 누락입니다. 검증 회차에서 도달성까지 확인됨.

## 심각도 분포

| 심각도 | 건수 | 대표 사례 |
|---|---|---|
| **block** | 2 | fs_api stale dist → `tsc` 빌드 실패 (P3-IMPORT-001/002) |
| **high** | 21 | 빌더 권한 잠금, 토큰 갱신 강제 로그아웃, 범위 삭제 오삭제(데이터 손실), 이메일 셀 빈값 저장, 형제 포크 Rules-of-Hooks 크래시·null guard 회귀 |
| **medium** | 43 | 다크모드 회귀 다수, 비동기 stale-closure 레이스, 타임존 off-by-one, 핸드롤 포털 ESC/포커스 누락 |
| **low** | 12 | 타이머 cleanup 누락, 색상 스와치 a11y, double-cast 표면, UX-5-002(검증 하향) |

> 원시 79건 집계에서 SYS-003 benign 제외(→78), UX-5-002 high→low 하향 반영.

## 종류별 분포

| 종류 | 건수 |
|---|---|
| bug (로직/비동기/타입) | ~46 |
| uiux | ~18 |
| a11y | 3 |
| cross-file / contract | 6 |

## high 이상 전체 목록 (영역별)

### 서버
- **SRV-A-001** (high) 빌더 편집 권한 fail-closed 잠금 → `40-server-bugs.md`
- **SRV-B-001** (high) 중복 `unhandledRejection` 핸들러가 서버 전체 강제 종료 → `40-server-bugs.md`

### 앱 FE / fs-api
- **PKG-A-001** (high) 토큰 갱신 후 retry 실패 시 유효 토큰 폐기 + 강제 로그아웃 → `30-other-packages.md`
- **PKG-A-002** (high) AbortError·네트워크 오류를 토큰 만료로 오분류 → 불필요한 refresh/로그아웃 → `30-other-packages.md`
- **PKG-B-001** (high) 다중 파일 업로드 진행률이 첫 파일 후 100% 로 점프 → `30-other-packages.md`

### 정본 뷰어 (fs-data-viewer)
- **DCV-2-001** (high) `createDateValue` toISOString 날짜 off-by-one → `20-fs-data-viewer-bugs.md`
- **DCV-3-001** (high) 범위 Backspace 삭제가 columnField 를 인덱스가 아닌 값 범위로 비교 → 오삭제·데이터 손실 → `20-fs-data-viewer-bugs.md`
- **DCV-4-001** (high) 잘못된 이메일 입력 시 빈 문자열 저장 → 이전 값까지 파괴 → `20-fs-data-viewer-bugs.md`
- **DCV-5-001** (high) `useUserCellCounts` 가 존재하지 않는 필드 읽음 → 모든 카운트 항상 0 → `20-fs-data-viewer-bugs.md`
- **DCV-6-001** (high) 캘린더 카드 재정렬이 음수 UTC 타임존에서 무음 실패 → `20-fs-data-viewer-bugs.md`
- **UX-2-001** (high) `FsGridCustomDialog` 가 await 전에 닫혀 로딩 미표시·에러 무음 → `21-fs-data-viewer-uiux.md`
- **UX-3-001** (high) 가이드 마크다운 표가 다크모드에서 판독 불가 → `21-fs-data-viewer-uiux.md`
- **UX-3-002** (high) 차트 에러 복구 다이얼로그 다크모드 깨짐 → `21-fs-data-viewer-uiux.md`

### 형제 뷰어 포크
- **EXT-DIFF-A-001** (high) external 뷰어 meta 로드가 저장 설정 미복원 → `23-viewer-siblings.md`
- **SUB-DIFF-A-001** (high) sub 뷰어가 정본 BUG-311 null guard 상실 → null row 에서 크래시 → `23-viewer-siblings.md`
- **SUB-DIFF-B-001** (high) `ServerPagingOverlay` 훅 호출 전 조건부 early-return → 크래시 → `23-viewer-siblings.md`
- **UX-5-001** (high) sub 뷰어가 frozen 컬럼 마킹은 유지하면서 고정 메커니즘 제거 → 고정 안 됨 → `23-viewer-siblings.md`

### 체계적 (Pass 1.5)
- **SYS-001** (high) `createDateValue` off-by-one 이 **3개 뷰어 포크 전부**에 복제 → `02-systemic-classes.md`
- **SYS-002** (high) Rules-of-Hooks 위반이 3개 중 2개 포크에 존재 → `02-systemic-classes.md`

### 크로스 레포
- **P3-CONTRACT-001** (high) `renameGroup` PATCH 가 존재하지 않는 서버 라우트로 → 무음 404 → `50-cross-repo-contract.md`
- **P3-COUPLING-001** (high) `notifyRowAdded` 가 grouped `groups` 상태 미동기 → 그룹핑 모드에서 추가 행 비표시 → `50-cross-repo-contract.md`
- **P3-IMPORT-001/002** (block) fs_api stale dist → `tsc` 빌드 실패 → `50-cross-repo-contract.md`

## 반복 테마 (영역 교차)
1. **타임존 off-by-one**: `new Date('YYYY-MM-DD')` UTC 파싱이 로컬 getter 와 충돌. KST(UTC+9) 배포라 마스킹되어 있으나 음수 UTC 사용자/서버 재해석 시 하루 밀림. (DCV-2-001, DCV-4-002, DCV-6-001, DCV-7-003, SYS-001)
2. **다크모드 회귀**: 뷰어는 색을 semanticColors→인라인 var() 로 흘리는데 하드코딩 Tailwind light 색이 `.dark` 에 반응 안 함. (02 문서 카탈로그)
3. **비동기 stale-closure 레이스**: 가상화 셀 렌더러가 cancel 플래그 없이 setState. (DCV-2-002/003/004)
4. **포크 분기 회귀**: 형제 뷰어가 정본 핫픽스를 상실하거나 UI 어포던스를 제거. (23 문서)
