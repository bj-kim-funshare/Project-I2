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

## v001.4.0

> 통합일: 2026-05-15
> 플랜 이슈: [#42](https://github.com/Team-Pingus/PinLog-Web/issues/42)

### 페이즈 결과

- **Phase 1 — `widgets/home-list` 신설 + MainPage B 분기 전환 (feat)**: 새 위젯 `src/widgets/home-list/` (HomeListLayout + TimelineCard) 추가. `useInfinitePostList(10)` + 날짜별 sticky 그루핑 (`createdAt.slice(0,10)`, z-10) + IntersectionObserver 페이지네이션. 카드: 좌측 시간(HH:mm) 마커 + 우측 4:5 사진 / 메모 첫 줄 / 작성자 아바타 (ProfileAvatar 우선, Goose `calm` 폴백 — `Post` 타입에 `goose_mood` 필드 부재). MainPage 의 `layout === 'B'` 분기를 `PostList` → `HomeListLayout` 으로 교체하고 미사용 `useDeletePost/useDialog/useTranslation/handleDeletePost` 정리. 커밋 `d5f2cb4` (+211/-29).
- **Phase 2 — A/C/D 위젯 디자인 시안 폴리시 (feat)**: 디자인 소스는 `PinLog_ 나만의 추억 SNS/prototype/screens-home.jsx` + `prototype/styles.css` (`final/` 미존재, `prototype/` 가 실 소스). A: `GridCard` radius var(--r-2) / shadow-1 / Pretendard 14·500 / hover:scale-[1.02], `HomeGridLayout` grid-cols-2 → sm:grid-cols-3. C: `CollageCard` 회전 4값(3°/-3°/2°/-2°) + shadow-2 + 절대위치 캡션 (place 우선), `HomeCollageLayout` pt-24/pb-48. D: `MapWithCarousel` 지도 rounded-r-4 + border + padding + 캐러셀 그립 핸들, `MapCarousel` 카드 280px 고정폭 + radius-3 + shadow-2 + ProfileAvatar. 커밋 `3216b70` (+43/-24).
- **Phase 3 — `main-layout` 폴리시 (Header + BottomNav + 중앙 FAB) (feat)**: 디자인 소스 `prototype/widgets.jsx` + `prototype/styles.css`. Header: sticky top-0 z-40, 기존 `<Badge>` 제거 후 `var(--color-mood-blue)` 8×8 absolute 닷, padding/border 토큰 정합. BottomNav: 4탭 `var(--color-mood-happy)` 2px 상단 라인 인디케이터 + active strokeWidth 2.4 / 비활성 1.8, 비활성 색 `var(--color-ink-3)`. FAB: 흰 배경 + `var(--color-line)` border + `var(--color-primary)` 아이콘 + primary shadow. **5초 hover easter egg 게임 모드 (상태/ref/useEffect/충돌 감지/트리거 조건) 전체 보존**. 커밋 `d23f80a` (+53/-36).
- **Phase 4 — Pull-to-refresh + 구스 sleepy→happy 전환 (feat)**: 신규 컴포넌트 `widgets/main-layout/ui/PullRefreshIndicator.tsx` — progress = pull/threshold, <0.8 sleepy / ≥0.8 happy (loading=true 도 happy + animate-bounce). opacity/scale/translateY transform 기반. MainPage 에 `usePullToRefresh({ threshold: 80, onRefresh })` 마운트, `onRefresh` 는 TanStack Query `['posts']` prefix 무효화 (실 queryKey 는 `['posts','infinite',size]`). D 의 PinPreviewSheet 활성 시 nullRef 차단. 커밋 `db49c37` (+56/-2).
- **Phase 5 — Settings 진입점 + 4 분기 안정화 (feat)**: SettingsPage 에 "홈 레이아웃 변경" 행 추가 (i18n 키 `home.layout.sectionTitle` + `home.pickTitle` 재사용) → `/pick-layout` 라우팅. MainPage 에 `safeLayout = (['A','B','C','D'] as const).includes(layout) ? layout : 'A'` 폴백 가드, 4 분기 모두 `safeLayout` 사용. LayoutPickerPage 는 이미 `selected={layout === kind}` 처리되어 있어 변경 없음. 커밋 `d090962` (+29/-5).
- **Phase 6 — pull-to-refresh 활성 ref 분기 (in-plan hotfix) (fix)**: Phase 4 가 보고한 blocker (MainPage `<main>` overflow-hidden → scrollTop=0 으로 PtR 트리거 부정확) 선제 해결. A/B/C 위젯에 optional `scrollRef?: RefObject<HTMLDivElement|null>` prop 추가 + 각자의 최상위 `h-full overflow-y-auto` 컨테이너에 마운트. MainPage 는 `mainScrollRef` 단일 ref 로 통합, `previewPostUuid !== null || safeLayout === 'D'` 일 때 nullRef 분기 (D 는 가로 캐러셀이라 세로 PtR 비대상). 커밋 `87fa277` (+19/-10).

### 영향 파일

PinLog-Web:
- `src/widgets/home-list/ui/HomeListLayout.tsx` (신규)
- `src/widgets/home-list/ui/TimelineCard.tsx` (신규)
- `src/widgets/home-list/index.ts` (신규)
- `src/widgets/home-grid/ui/GridCard.tsx`
- `src/widgets/home-grid/ui/HomeGridLayout.tsx`
- `src/widgets/home-collage/ui/CollageCard.tsx`
- `src/widgets/home-collage/ui/HomeCollageLayout.tsx`
- `src/widgets/map-post-feed/ui/MapWithCarousel.tsx`
- `src/widgets/map-post-feed/ui/MapCarousel.tsx`
- `src/widgets/main-layout/ui/Header.tsx`
- `src/widgets/main-layout/ui/BottomNav.tsx`
- `src/widgets/main-layout/ui/PullRefreshIndicator.tsx` (신규)
- `src/widgets/main-layout/index.ts`
- `src/widgets/index.ts`
- `src/pages/MainPage.tsx`
- `src/pages/SettingsPage.tsx`

### 알려진 후속

- B (home-list) 타임라인의 시각 정합은 디자인 소스 경로 (`prototype-v2/` 부재, `prototype/` 가 실 소스) 가 Phase 2 에서 확정 — Phase 1 은 텍스트 사양 기반 구현. 머지 후 마스터 수동 검수에서 `prototype/screens-home.jsx` B 섹션과의 정합 보강 권장.
- 기존 `widgets/post-list/` 는 본 플랜에서 유지 — MainPage 의 B 분기만 home-list 로 교체. 타 페이지에서의 PostList 사용 여부 후속 점검 후 미사용이면 정리 가능.
- 베이스라인 `react-hooks/exhaustive-deps` 경고 8건 (Phase 1 신규 1건 — home-list 의 `posts` useMemo 패턴이 PostList/MapPostFeed 와 동일) — 본 플랜 범위 외.
- 신규 i18n 키 추가는 회피했음. "홈 레이아웃 변경" 행은 기존 키 재사용 — 차후 i18n 정리 시 전용 키 추가 권장.

## v001.5.0

> 통합일: 2026-05-15
> 플랜 이슈: [#43](https://github.com/Team-Pingus/PinLog-Web/issues/43)

### 페이즈 결과

- **Phase 1 — post-compose 스캐폴드 + drop-in 애니 + i18n 키 (feat)**: `widgets/post-compose/` (model + ui) 신설. `usePostCompose` 상태기계 스텁 (`currentStep: 'photo'|'details'|'success'`, `goNext/goBack/reset`). 세 step 스텁 컴포넌트 (data-testid + i18n 헤딩). `shared/styles/index.css` 에 `drop-in` keyframe (300ms cubic-bezier(0.16, 1, 0.3, 1)) + `.animate-drop-in` + `prefers-reduced-motion` 게이트. ko/en i18n `post` 블록 끝에 10개 키 (photoStep / detailsStep / success / posted / tagPlaceholder / scopeLabel / capsuleLabel / permissionDenied / fromCamera / fromAlbum) **additive-only** 추가. 커밋 `d92c1db` (+110/-0).
- **Phase 2 — PostPhotoStep (카메라/앨범 분리 + 권한 폴백) (feat)**: usePostCompose 를 useState → **Zustand store 로 전환** (cross-step 상태 공유 필요 — 의도된 deviation). selectedFiles / previewUrls / uploadedFiles / fileGroupUuid 필드 + setter 액션 추가. PostPhotoStep 본문: cameraInputRef (`capture="environment"`) + albumInputRef (no capture) 두 hidden input 분리, 각각 "사진 찍기" / "앨범에서 선택" 버튼. 5장·5MB 제한 + URL.createObjectURL 생성·revoke 롤백. i18n `selectPhoto/addMore/photoLimitHit` 추가. 커밋 `5b7ee51` (+208/-18).
- **Phase 3 — location-picker 500m POI 자동제안 + 디바운스 (refactor)**: Kakao `places.categorySearch` 기반 반경 500m POI auto-suggest. 6개 카테고리 (FD6 음식점 / CE7 카페 / AT4 관광 / CT1 문화 / SW8 지하철 / BK9 은행) 병렬 조회 → 거리순 상위 5개. idle 이벤트마다 Haversine 거리 → 직전 좌표 50m 이내 이동은 API skip (**Kakao quota 보호 — 사전 위험 해소**). 키워드 검색 250ms 디바운스 + unmount cleanup. POI 클릭 시 setCenter 재진입 루프 방지를 위해 lastQueriedLatLngRef 선갱신. `LocationResult` 타입에 `placeName?: string` optional 추가 + `index.ts` re-export. 커밋 `ccb9c3c` (+175/-29).
- **Phase 4 — PostDetailsStep (UI-only 시드) + Chip (feat)**: usePostCompose 에 `content / location / tags[] / scope / capsuleEnabled / isSubmitting / submitError` 필드 + 액션 추가. `shared/ui/Chip.tsx` 신설 (gray pill, rounded-full, optional × 제거 버튼) + `shared/ui/index.ts` export. PostDetailsStep 본문: 정비된 LocationPicker + 메모 textarea (500자) + 태그 칩 시드 (엔터/쉼표, max 10, 중복 제거) + ScopeToggle 시드 (default 'public') + 캡슐 Tailwind 토글 시드. "올리기" → PostDetailsStep 내부에서 `useCreatePost` 호출 → pending/error 스토어 반영 → 성공 시 `goNext()`. **`PostCreateRequest` 시그니처 미변경** (content / file_group_uuid / lat / lng) — UI-only 제약 준수. 커밋 `ac82cfe` (+244/-2).
- **Phase 5 — PostSuccessStep 풀스크린 드롭 애니 + 1.5s 홈 자동 이동 (feat)**: 풀스크린 fixed 오버레이 (`fixed inset-0 z-50`) + 원형 체크마크 SVG + `t('post.posted')` + `.animate-drop-in`. useEffect 로 1500ms `setTimeout` → `navigate('/')` (unmount cleanup). `prefers-reduced-motion` 감지 시 클래스 미부여로 애니 skip, 타이머는 유지. 커밋 `aa13f04` (+44/-2).
- **Phase 6 — WritePage 3-step orchestrator 재작성 + 테스트 (refactor)**: 266라인 monolithic → 52라인 orchestrator. `usePostCompose.currentStep` 으로 세 스텝 컴포넌트 조건부 렌더. 언마운트 시 `reset()` cleanup. photo/details 단계 "1/2" 인디케이터. `WritePage.test.tsx` 신설 — 스텝 컴포넌트 vi.mock + Zustand store 직접 조작 검증 (2 tests pass). 커밋 `a8bd5bb` (+90/-248).
- **Phase 6 후속 1 — common.back i18n 키 추가**: WritePage 가 사용하는 `t('common.back')` 누락 보강 (ko: "뒤로", en: "Back"). 커밋 `f81e637` (+2/-0).
- **Phase 6 후속 2 — WritePage.test 환경변수 의존성 제거**: `vi.importActual('@/widgets/post-compose')` 가 PostDetailsStep → useCreatePost → API base URL check 까지 끌고 가 `VITE_API_BASE_URL` 오류 → 모의 팩토리에서 importActual 제거 + usePostCompose 직접 모델 경로 import 로 우회. 커밋 `0dbfbdd` (+6/-7).
- **Phase 6 후속 3 — PostPhotoStep 자동 전진 제거 + 수동 다음 버튼 (fix)**: advisor 사전 감지 — 첫 업로드 성공 시 `onSuccess` 안에서 `goNext()` 호출이 multi-photo 누적 (5장까지) 흐름을 깨고 카메라/앨범 분리 의미를 상실시킴. `onSuccess` 의 `goNext()` 제거 + 하단 수동 "다음" 버튼 추가 (`uploadedFiles.length === 0 || uploadFiles.isPending` 일 때 disabled). 커밋 `f2ff106` (+8/-1).

### 영향 파일

PinLog-Web:
- `src/pages/WritePage.tsx` (재작성)
- `src/pages/__tests__/WritePage.test.tsx` (신규)
- `src/widgets/post-compose/index.ts` (신규)
- `src/widgets/post-compose/model/usePostCompose.ts` (신규)
- `src/widgets/post-compose/ui/PostPhotoStep.tsx` (신규)
- `src/widgets/post-compose/ui/PostDetailsStep.tsx` (신규)
- `src/widgets/post-compose/ui/PostSuccessStep.tsx` (신규)
- `src/widgets/index.ts`
- `src/widgets/location-picker/ui/LocationPicker.tsx`
- `src/widgets/location-picker/index.ts`
- `src/shared/ui/Chip.tsx` (신규)
- `src/shared/ui/index.ts`
- `src/shared/styles/index.css`
- `src/shared/lib/i18n/locales/ko.ts`
- `src/shared/lib/i18n/locales/en.ts`

### 검증

- `pnpm lint` PASS (0 errors / 8 baseline warnings — 본 플랜 범위 외).
- `pnpm tsc --noEmit` PASS (0 errors).
- `pnpm vitest run src/pages/__tests__/WritePage.test.tsx` PASS (2/2).

### 알려진 후속 / 수동 검증 항목

- `/write` 진입 → 카메라 또는 앨범 사진 선택 → "다음" → 메모/태그/스코프/캡슐 입력 → 위치 (지도 idle 시 500m POI 5개 표시 확인) → "올리기" → 성공 풀스크린 1.5초 → 홈 복귀. **마스터 수동 click-through 권장**.
- POI categorySearch quota 우려 → Phase 3 의 50m skip 임계로 사전 해소. 실측 quota 모니터링은 운영 단계.
- 디자인 시안의 success drop 정확한 움직임 (bounce 여부) 불명 → cubic-bezier(0.16, 1, 0.3, 1) 로 근사. 디자이너 피드백 시 핫픽스 가능.
- scope / tags / capsule 토글은 **UI-only 시드** — `PostCreateRequest` 미전송. 단계 2-A/B (BE 확장) + 단계 2-C 후속에서 실 데이터 전환 예정 (roadmap Phase 2 명시).
- iOS Safari `<input capture>` 미지원 변종에서 갤러리만 열림 — 표준 폴백 동작에 의존. UA sniff 의도적 회피.
- `usePostCompose` 의 useState → Zustand 전환은 의도된 deviation — cross-step 상태 공유 요구를 충족하기 위함. Phase 6 의 thin orchestrator 패턴 성립의 전제.
- PostDetailsStep 의 `data-testid` 미부여 (현재 mock 으로 통합 테스트 우회). 통합 테스트 작성 시 testid 추가 필요.
