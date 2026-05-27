# 앱 FE — 버그 클래스 (data-craft/src)

> 스코프 APP-A(entities/shared) · APP-B(features) · APP-C(widgets/pages/app). 앱 FE 코어는 광범위한 핫픽스로 강하게 방어되어 있어 버그 클래스 발견은 적다(검증 VS-2: 전건 CONFIRMED, 1건 파일경로 ADJUST).

---

## APP-A-001 (medium · bug) — `removeHistoryItem` 이 페이지네이션 totalCount 를 로컬 필터 길이로 덮어씀
- 파일: `src/entities/input-data/model/formWidgetHistoryActions.ts:80`
- `removeHistoryItemAction` 이 한 행 필터 후 `totalCount: updatedItems.length` 로 설정. 그러나 `totalCount` 는 서버 측 전체 레코드 수(별도 필드, `formWidgetStoreTypes.ts` 에 '전체 아이템 수' 명시)로 페이지네이션에 쓰임. Individual 모드에서 이력 1건 삭제 시 totalCount 가 현재 로드 페이지 수로 붕괴 → load-more/페이지 수/has-next 로직 오염. 올바른 동작은 1 감소(0 클램프).
- 검증: CONFIRMED (totalCount 가 setHistoryItemsAction 으로 독립 설정됨 확인).

## APP-A-002 (medium · bug) — `updatePage` 낙관적 롤백이 동시 업데이트의 확정 결과를 지움
- 파일: `src/entities/page/model/pageDataActions.ts:71`
- `updatePage` 가 `previousPages` 스냅샷 후 낙관적 적용, 서버 실패 시 복원. deletePage/saveLayoutChanges 와 달리 진입 시 `isUpdating` 미체크라 동시 호출 허용. A 스냅샷→A 적용, B 가 A-낙관 상태 스냅샷→B 적용, B 서버 확정, A 서버 실패→A 스냅샷(=B 이전)으로 롤백 → B 의 확정 결과 소실. 파일 주석(L72-74)이 위험을 명시했으나 가드 미추가. 관측: 성공한 편집이 무관한 동시 편집 실패 시 무음 되돌림.
- 검증: CONFIRMED (deletePage 는 isDeleting 가드 L108 보유, updatePage 만 누락).

## APP-B-001 (low · bug) — bare `setTimeout`(스텝 전환+리셋)이 언마운트 시 미추적/미해제
- 파일: `src/features/subscription/ui/PaymentPasswordSetupStep.tsx:132` (및 L191)
- 500ms `setTimeout` 이 `setStep`/`setSecond`/`setSeed`/`resetToEnter` 호출. ref 미저장·언마운트 cleanup 없음. 다이얼로그가 500ms 내 닫히면 언마운트 컴포넌트에서 setter 발화(React 18 dev 경고, no-op). 같은 파일 countdown 인터벌은 올바르게 ref 추적/해제됨과 대조.
- 검증: CONFIRMED.

## APP-B-002 (low · bug) — `triggerError` 의 bare `setTimeout` 미해제
- 파일: `src/features/subscription/ui/PaymentPasswordInputDialog.tsx:100`
- `triggerError()` 의 500ms `setTimeout` 이 `reset()` 호출. ref/clearTimeout 없음. shake 윈도 내 닫힘 시 언마운트 컴포넌트에서 reset. APP-B-001 과 동일 클래스.
- 검증: CONFIRMED.

## APP-C-001 (low · bug) — `validationErrors` 자동소멸 effect 의존성에 매 렌더 새 객체 포함 → 타이머 반복 리셋
- 파일: `src/widgets/file-uploader-widget/ui/FileUploader.widget.tsx:54`
- 3초 후 토스트 비우는 effect 의 deps 가 `[state.validationErrors, state]` 인데 `useFileUploaderState` 가 매 렌더 새 객체 리터럴 반환(L92, no useMemo) → 매 렌더 effect 재실행 → clearTimeout→새 setTimeout 으로 3초 타이머 계속 리셋. 검증 에러 표시 중 드래그/업로드 진행 등 리렌더 반복 시 토스트가 자동 소멸 안 함. 의도 deps 는 `[state.validationErrors, state.setValidationErrors]`. 동일 패턴 `useNotification.ts:37` 은 `[notification]` 으로 올바름.
- 검증: CONFIRMED (setter 는 안정적 useState setter 이므로 제안 수정 유효).

---

### 제외/하위임계 (no-pad 원칙)
- usePlanExpiryNotification 새 배열 매 렌더(버그 클래스 아님), LogoUploadDialog 이중 핸들러(동기 클리어로 no-op), requestValueDuplicatedCheck 에러 시 true 반환(의도적 fail-safe), InputDataSyncIndicator 타이머(매 effect cleanup — 올바름), SSE online/offline 리스너(동일 참조로 idempotent — 후보였으나 철회).
