# Pinlog — Patch Note (001)

## v001.1.0 — Commit&Push 대기중

## v001.2.0

> 통합일: 2026-05-15
> 플랜 이슈: [#40](https://github.com/Team-Pingus/PinLog-Web/issues/40)

### 페이즈 결과

- **Phase 1 — UI 프리미티브 3종 시드 (feat)**: `src/shared/ui/` 에 StickerRow / PinMini / ScopeToggle 시드 추가. SCREENS.md §08 (핀 상세 리액션 바), §16 (스레드 핀 공유 카드), §05 (핀 작성 공개 범위) 디자인 의도 기반. `role=radiogroup` + 44px 터치 + Tailwind v4 시맨틱 토큰 사용. `index.ts` 재내보내기 갱신. 커밋 `95e3545` (+190/-0).
- **Phase 2 — 구스 마스코트 컴포넌트-자산 동기화 (refactor)**: `Goose.tsx` 의 `GooseMood` 유니온 + `GOOSE_ASSETS` 맵에 `calm`, `collect` 추가. 디스크 자산 10종 ↔ 컴포넌트 타입 10종 정합 (dead asset 2건 해소). 커밋 `7b03c22` (+7/-1).
- **Phase 3 — HANDOFF.md 경로 표준화 (chore)**: `PinLog_ 나만의 추억 SNS/docs/HANDOFF.md` → `docs/HANDOFF.md` `git mv` 이동 (rename 추적). prose sibling 참조 1건 갱신. 4종 sibling (SCREENS/SPEC/DESIGN/TECH) 은 옵션 B 의 문자 그대로 해석에 따라 한글 디렉토리 잔존. 커밋 `c0e4e64` (+1/-1).

### 영향 파일

PinLog-Web:
- `src/shared/ui/StickerRow.tsx` (신규)
- `src/shared/ui/PinMini.tsx` (신규)
- `src/shared/ui/ScopeToggle.tsx` (신규)
- `src/shared/ui/index.ts`
- `src/shared/ui/Goose.tsx`
- `docs/HANDOFF.md` (신규 위치, rename from `PinLog_ 나만의 추억 SNS/docs/HANDOFF.md`)

### 알려진 후속

- 베이스라인 lint 20 errors / 7 warnings (Dialog/Toast/LocationPicker/MapPostFeed) 은 본 플랜 시작 전부터 존재 — 별도 정리 플랜 권장.
- HANDOFF.md 내 코드블록 프롬프트 본문의 sibling 참조 5건 (`docs/SPEC.md` 등) 은 의도적 보존. 4종 sibling 도 `docs/` 로 이동하면 일관성 회복.
- `Goose` 마스코트 9 vs 10 정합 결정: 10유지로 종결. 향후 디자인이 9로 줄어들 경우 추가 정리 필요.

## v001.3.0

> 통합일: 2026-05-15
> 플랜 이슈: [#41](https://github.com/Team-Pingus/PinLog-Web/issues/41)

### 페이즈 결과

- **Phase 1 — Foundation utils + 스토어 플래그 (feat)**: `shared/lib/useDebounce` (400ms 기본), `shared/lib/geolocation.requestGeoPermission()` (`navigator.geolocation` Promise wrapper), `authStore.onboarded` + `setOnboarded` + persist `partialize` 갱신, `homeLayoutStore.layoutChosen` + `setLayout` 동시 set + 마이그레이션 경로 (legacy `feed-mode-storage` 보유자 = `true`). 커밋 `6e0bd8e` (+55/-2). 별도 위생 커밋 `524a7ff` (+63/-16) 로 베이스라인 lint 적색 (Dialog/Toast/LocationPicker/MapPostFeed 4 파일, 20 errors) 해소 — 마스터 승인 스코프 확장.
- **Phase 2 — `widgets/onboarding/` 슬라이스 신설 (feat)**: GreetingStep (구스 wave 120px + 말풍선 + [시작하기]), HandleStep (이름 2–12자 + 핸들 `^[a-zA-Z0-9_]{3,16}$`, `useDebounce(handle, 400)` + 인라인 가용성 표시 + CTA disabled until valid), LocationStep (`requestGeoPermission()` 호출 후 양 경로 모두 `onDone()`). `onboardingStore` (step/nick/handle/geoStatus, no persist). `useHandleAvailability` 는 mock (예약어 `['admin','root','pinlog']` + 250ms 가짜 latency, BE 엔드포인트 부재 확인됨) + 상단 `TODO(BE-Phase2)` 주석. 커밋 `bfdce8e` (+257/-0).
- **Phase 3 — `OnboardingPage` + 라우트 (feat)**: OnboardingPage 가 `step` 1/2/3 분기로 GreetingStep/HandleStep/LocationStep 전환, LocationStep `onDone` 에서 `setOnboarded(true)` → `reset()` → `navigate('/pick-layout', { replace: true })`. Router 에 `OnboardingPageGuard` 인라인 컴포넌트 (`onboarded === true` 면 `/` 로 리다이렉트) + `/onboarding` PrivateRoute 등록. `src/pages/index.ts` 부재로 신규 생성. 커밋 `e6703e1` (+39/-1).
- **Phase 4 — `SplashGate` 래핑 + 4-way invariant (feat)**: 앱 루트 래퍼. 첫 마운트 시 `setTimeout(2500)` race + `checkAuth()` 동기 호출 (`raceDone` state, 1회성). 매 렌더마다 4-way invariant 매트릭스 평가 — `/` (미인증→`/auth`, 인증&!onboarded→`/onboarding`, 인증&onboarded&!layoutChosen→`/pick-layout`), `/auth` (인증→`/`), `/onboarding` (미인증→`/auth`), `/pick-layout` (미인증→`/auth`, !onboarded→`/onboarding`). SplashView 는 `bg-goose-soft` + Goose `wave` 110px + "PinLog" Caveat 52px + 태그라인. Router 의 `<Routes>` 를 `<SplashGate>` 로 래핑. 커밋 `061ca7b` (+64/-2).
- **Phase 5 — LayoutPicker 미니 프리뷰 폴리시 (feat)**: 4종 프리뷰 (AGrid / BList / CCollage / DMap) 독립 컴포넌트로 분리 → `widgets/layout-picker/ui/previews/`. LayoutCard 에 `preview?: ReactNode` prop 추가 (기존 PREVIEWS 폴백 유지로 테스트 호환). LayoutPickerPage post-pick navigate 를 `'/', { replace: true }` 로 갱신. 커밋 `dcf8111` (+69/-14).
- **Phase 6 — FirstPinPrompt EmptyState 통합 (feat)**: `widgets/onboarding/ui/FirstPinPrompt` (EmptyState + 구스 `curious` + primary CTA [첫 핀 꽂기] → `/write` + 옵션 ghost CTA [둘러보기]). MainPage 가 `useInfinitePostList(1)` 로 핀 유무 경량 감지, 로딩 후 0건이면 중앙에 FirstPinPrompt 렌더, 4 레이아웃 분기는 `!isEmpty` 게이팅. AuthPage 무수정 (Phase 4 SplashGate invariant 가 처리). 커밋 `9081a46` (+45/-5).

### 영향 파일

PinLog-Web:
- `src/shared/lib/useDebounce.ts` (신규)
- `src/shared/lib/geolocation.ts` (신규)
- `src/shared/lib/index.ts` (신규)
- `src/shared/store/authStore.ts`
- `src/shared/store/homeLayoutStore.ts`
- `src/shared/ui/Dialog.tsx` (위생)
- `src/shared/ui/Toast.tsx` (위생)
- `src/widgets/location-picker/ui/LocationPicker.tsx` (위생)
- `src/widgets/map-post-feed/ui/MapPostFeed.tsx` (위생)
- `src/widgets/onboarding/index.ts` (신규)
- `src/widgets/onboarding/model/onboardingStore.ts` (신규)
- `src/widgets/onboarding/model/useHandleAvailability.ts` (신규)
- `src/widgets/onboarding/ui/GreetingStep.tsx` (신규)
- `src/widgets/onboarding/ui/HandleStep.tsx` (신규)
- `src/widgets/onboarding/ui/LocationStep.tsx` (신규)
- `src/widgets/onboarding/ui/FirstPinPrompt.tsx` (신규)
- `src/widgets/index.ts`
- `src/pages/OnboardingPage.tsx` (신규)
- `src/pages/index.ts` (신규)
- `src/pages/LayoutPickerPage.tsx`
- `src/pages/MainPage.tsx`
- `src/app/SplashGate.tsx` (신규)
- `src/app/SplashView.tsx` (신규)
- `src/app/router/Router.tsx`
- `src/widgets/layout-picker/ui/LayoutCard.tsx`
- `src/widgets/layout-picker/ui/previews/AGridPreview.tsx` (신규)
- `src/widgets/layout-picker/ui/previews/BListPreview.tsx` (신규)
- `src/widgets/layout-picker/ui/previews/CCollagePreview.tsx` (신규)
- `src/widgets/layout-picker/ui/previews/DMapPreview.tsx` (신규)

### 알려진 후속

- 이미 마이그레이션을 마친 사용자 (`feed-mode-storage` 소비 후 `home-layout-storage` 만 잔존) 는 `layoutChosen=false` 로 rehydrate → SplashGate 가 `/pick-layout` 1회 재노출 후 카드 선택 시 영구 `true`. mild UX, hotfix 가능.
- `useHandleAvailability` 는 mock — `Pingus-Server` 핸들 중복 체크 엔드포인트 신설 후 실 BE 호출로 교체 (단계1-A 범위 외).
- FirstPinPrompt 의 [둘러보기] 보조 CTA destination 미정 — 디자인 PM 협의 필요.
- MainPage 의 `useInfinitePostList(1)` 가 별도 캐시 키 (pageSize 다름). 실질 중복 요청 없으나 캐시 공유 원하면 pageSize 통일 또는 공용 훅 추출 (범위 외).
- 베이스라인 `react-hooks/exhaustive-deps` 경고 7건 잔존 (사전 baseline, 본 플랜 범위 외).
