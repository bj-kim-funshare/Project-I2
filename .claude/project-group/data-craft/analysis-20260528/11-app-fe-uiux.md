# 앱 FE — UI/UX (data-craft/src)

> 스코프 UX-1(features/pages/widgets 사용자 흐름). 파괴적 다이얼로그·인증·결제 실패 페이지는 대체로 양질(확인+disabled 상태, 복귀 경로 있음). 주요 결함 클래스는 다크모드 회귀.

---

## UX-1-001 (medium · uiux) — 빌더 빈 상태 아이콘 칩이 하드코딩 light 색(dark: 없음) → 다크모드에서 밝은 얼룩
- 파일: `src/widgets/layout-canvas/ui/EmptyPageState.tsx:66`
- 빌더 전체의 1차 빈 표면(페이지 미등록 + 빈 페이지). 아이콘 칩이 `bg-violet-100`/`text-violet-500` + Sparkles `bg-amber-100`/`text-amber-500` 를 `dark:` 변형 없이 사용. 다크모드에서 밝은 흰빛 얼룩, amber 배지는 사실상 비가시. 형제 chrome(EmployeeTabContent, SettingsSidebar, DeletePageDialog)은 일관되게 `dark:` 페어를 둠. 신규 사용자가 처음 보는 화면이 다크모드에서 깨짐.

## UX-1-002 (medium · uiux) — 인라인 EmptyState + LayoutErrorState 하드코딩 light 색
- 파일: `src/widgets/layout-canvas/ui/LayoutCanvas.tsx:98`
- (1) 로컬 EmptyState(L98-102, 디자인 모드 'compose your page')가 UX-1-001 과 동일 칩 패턴. (2) LayoutErrorState(L132-143)가 `border-red-300`/`bg-red-50`/`text-red-600` 를 `dark:` 없이 사용 → 다크 캔버스에 밝은 빨강 블록(앱 표준은 `destructive`/`bg-destructive/10` 토큰). 둘 다 전체 캔버스 상태로 가시성 높음.

## UX-1-003 (medium · uiux) — 파일 검증 토스트가 light 전용 chrome(흰 박스 + text-red-700)
- 파일: `src/widgets/file-uploader-widget/ui/FileUploader.widget.tsx:80`
- `FILE_TOAST_CLASSES`(공유: `bg-white ...`) + `text-red-700` 가 `dark:` 변형 없음 → 다크모드에서 흰 카드+짙은 빨강 텍스트로 명암 반전. 토스트 컨테이너는 3개 파일 위젯이 공유하는 상수라 회귀가 넓음. (Pass-1 APP-C-001 은 동일 파일의 타이머 버그로 별개.)

## UX-1-004 (low · uiux) — 미저장 변경 다이얼로그의 파괴적 어포던스 이중 인코딩
- 파일: `src/features/unsaved-changes-guard/ui/UnsavedChangesDialog.tsx:67`
- 안전 동작(취소/머무름, 손실 없음)이 빨강 텍스트(`text-red-500`), 파괴적 동작(저장 안 함/변경 폐기)이 빨강 채움 버튼(`bg-red-500`). 두 빨강 요소의 의미 반전 → 색으로 스캔하는 사용자가 어떤 버튼이 작업을 폐기하는지 오인, 미저장 손실 위험. 표준은 파괴적-빨강을 폐기 동작에만, 취소/머무름은 중립.

---

### 검증/품질 확인된 양호 항목
구독 다단계·회원가입·SiteCreation 샘플 결과 임계 이상 결함 없음. CancelSubscription/DeleteCard/DeletePage 파괴적 다이얼로그는 AlertDialog + 확인 + disabled/processing 상태로 양호. ImageZoomDialog/NotificationDropdown 은 ESC·포커스·aria-live 처리 정상.
