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

## v001.6.0

> 통합일: 2026-05-16
> 플랜 이슈: [#44](https://github.com/Team-Pingus/PinLog-Web/issues/44)

### 페이즈 결과

- **Phase 1 — post-detail 시안 적용 (refactor)**: `PostDetailView` 를 시안 컨벤션에 맞춰 정돈. `PostPhoto` 신설 (FileVO[] 기반 4:5 비율 컨테이너 + 다중 사진 snap-x 가로 캐러셀), `PostScopeBadge` 신설 (`private`/`friends`/`public` 미니멀 배지), `PostTagChips` 신설 (`Chip` 반복 렌더, 빈 배열 미렌더). 프로필 이미지 null 시 `Goose` happy fallback, 본문 메모 `--font-brand` (Gaegu) 17px, `StickerRow` 5표정 (`happy/love/curious/think/surprised`), 댓글 입력 `sticky bottom-0` + safe-area-inset-bottom. `tokens.css` `--font-brand` Caveat → Gaegu 변경, `index.css` Google Fonts Gaegu @import 추가. 커밋 `d305f2f` (+128/-16).
- **Phase 2 — ⋯ 메뉴 본인/타인 분기 (feat)**: 인라인 ⋯ 메뉴 (`showMenu` state + `menuRef` + 외부 클릭 감지 + 드롭다운 마크업) 를 `PostKebabMenu` 컴포넌트로 분리. `isAuthor(accountInfo?.uuid === post.account_uuid)` 분기 — 본인은 편집/삭제, 타인은 신고/뮤트 (stub: `console.warn` + 기존 `useToast(info)` 호출). 별도 hook 파일 미작성 (BE 도착 시 형태 일치 위해). 커밋 `18c96c4` (+128/-62).
- **Phase 3 — `/post/:uuid` 라우트 신설 + `[자세히]` 와이어링 (feat)**: React Router DOM 에 `/post/:uuid` 동적 경로를 `PrivateRoute` 래퍼로 신설. `PostDetailPage` 신설 (`useParams<{uuid}>()` → `<PostDetailView postUuid={uuid} onBack={navigate(-1)} onEdit={navigate('/write')} />`, uuid 부재 시 `<Navigate to="/" replace />`). `PinPreviewSheet` 의 `[자세히]` 가 `onClose()` → optional `onDetail?.(uuid)` → `navigate(`/post/${uuid}`)` 순으로 동작하도록 변경 (기존 `onDetail` prop 옵셔널화로 backwards-compat 유지). 커밋 `454b654` (+39/-2).
- **Phase 4 — MemoryMapScreen 정비 (refactor)**: `MapPostFeed` 를 제어 컴포넌트로 전환 (내부 `usePostList()` 제거, `posts` prop 수신). `MapWithCarousel` 에서 `useMapFilters` + `applyClientFilter` 로 필터링한 결과를 `MapPostFeed`/`MapCarousel` 양쪽에 주입. `availableTags` 는 원본 `postList` 기준 `useMemo` 계산 (선택 해제 후에도 칩 잔존). `MapFilterChips` 가 40% 지도 섹션 최상단에 항상 표출 (period/scope/tags). 인라인 빈 상태 오버레이 → 공용 `EmptyState`(goose=`wave`, CTA "첫 핀 남기기") 교체. `onEmptyCta` prop 으로 `MainPage` 에서 `navigate('/write')` 주입. 핀 탭 → `PinPreviewSheet` 우선 (PHASE 06 기존 와이어링 보존). 커밋 `4f66023` (+39/-17).

### 영향 파일

PinLog-Web:
- `src/widgets/post-detail/ui/PostDetailView.tsx`
- `src/widgets/post-detail/ui/PostPhoto.tsx` (신규)
- `src/widgets/post-detail/ui/PostScopeBadge.tsx` (신규)
- `src/widgets/post-detail/ui/PostTagChips.tsx` (신규)
- `src/widgets/post-detail/ui/PostKebabMenu.tsx` (신규)
- `src/widgets/post-detail/ui/index.ts`
- `src/pages/post-detail/PostDetailPage.tsx` (신규)
- `src/pages/post-detail/index.ts` (신규)
- `src/app/router/Router.tsx`
- `src/pages/MainPage.tsx`
- `src/widgets/map-post-feed/ui/MapPostFeed.tsx`
- `src/widgets/map-post-feed/ui/MapWithCarousel.tsx`
- `src/widgets/map-post-feed/ui/PinPreviewSheet.tsx`
- `src/shared/styles/index.css`
- `src/shared/styles/tokens.css`

### 검증

- `pnpm lint` PASS 4회 (Phase 1~4 각각, 0 errors / 8~9 baseline warnings — 본 플랜 범위 외).
- 페이즈별 메인 세션 verification 6-step (git show --stat / scope 확인 / diff 정독 / 의미 검증 / blockers 정리 / lint gate) 모두 PASS.

### 알려진 후속 / 수동 검증 항목

- `/post/<mock-uuid>` 직접 진입 시 핀 상세 시안 렌더 확인 (예: `/post/p001`). **마스터 수동 click-through 권장**.
- 메인 페이지 Layout D → 필터 칩 (기간/태그/scope) 토글 시 지도 + 캐러셀 필터 동기 확인.
- 지도 핀 탭 → 바텀시트 프리뷰 → `[자세히]` → `/post/:uuid` 라우팅 확인.
- 빈 상태 (필터 결과 0건) → EmptyState (Goose wave + "첫 핀 남기기") 확인.
- 본인 핀 ⋯ 메뉴 (편집/삭제) vs 타인 핀 ⋯ 메뉴 (신고/뮤트 stub) 분기 확인.
- **신고/뮤트 stub**: `console.warn` + toast info 만. BE 확장 (단계 2-A/B) 시 실제 API 연결 — `useReportPost`/`useMuteUser` hook 형태는 BE 시그니처 도착 후 신설 권장 (현 단계 미작성).
- **scope 배지 / 태그 칩 mock fallback**: MSW handlers 가 fixture posts.json 의 `scope`/`tag_list` 를 반환 중이므로 추가 작업 불필요. Phase 2 BE 확장 시 실 API 응답으로 자연 전환.
- **MainPage `onEdit` 핸들러 미완성** (Phase 3 phase-executor 보고): `setEditingPostUuid` 만 세팅하고 `/write` 로 navigate 하지 않음. 별도 정리 플랜 권장.
- `--font-brand` 토큰을 Caveat → Gaegu 로 전역 변경 — 다른 컴포넌트가 향후 `--font-brand` 사용 시 영향. 의도적.
- Gaegu 폰트 자산은 Google Fonts CDN `@import` 로 등록 — 오프라인 환경 또는 CSP 강화 시 self-host 전환 필요.

## v001.7.0

> 통합일: 2026-05-16
> 플랜 이슈: [#45](https://github.com/Team-Pingus/PinLog-Web/issues/45)

### 페이즈 결과

- **Phase 1 — MyPage 헤더 정비 (feat)**: `MyPageView` 의 프로필 카드를 `ProfileAvatar` 제거 → `Goose(mood=happy, size=96)` + 닉네임 + `@handle` (닉네임 소문자/공백제거 fallback) 레이아웃으로 재구성. 신규 `ProfileStatsRow` 가 핀/친구/캡슐 3-카운트 행을 카드 하단에 배치 (친구·캡슐 0 고정, 핀도 my-pins endpoint 부재로 0 placeholder). i18n ko/en/ja `myPage.handle`, `myPage.stats.{pins,friends,capsules}` 추가. 커밋 `e63a3e9` (+64/-16).
- **Phase 2 — MyPage 탭 인프라 3탭 (feat)**: `MyPageView` 본문에 `ProfileTabs` 추가 + URL `?tab=pins|map|capsule` 동기화. 핀 그리드 탭(`MyPinsGridTab`)은 `useInfinitePostList` + `GridCard` 재사용 3열 그리드. 추억지도 탭(`MyMemoryMapTab`)은 `MapPostFeed` 사용자 필터 prop 부재로 빈 상태 fallback. 캡슐 보관함 탭(`MyCapsuleVaultTab`)은 disabled 시안 (Goose think + lock 배지 + "준비 중") + 클릭 시 `capsuleLocked` 토스트. ko/en/ja 8개 i18n 키 추가. 커밋 `cea4fac` (+234/-4).
- **Phase 3 — Notification 6-kind 분기 UI + Activity 헤더 (feat)**: `NotificationItem` 의 `isPhase1Navigable` 불리언을 `routeActionByKind` switch 로 교체 — `comment→/post/:uuid?focus=comments`, `like→/post/:uuid`, `friend→/my` (fallback), `capsule·memory·dm→토스트+LockBadge`. 카드 시안 6 kind 동일. `ActivityPage` 헤더에 `Goose(mood=love, size=52)` + `activity.header.{title,subtitle}` 영역. 탭 본문 무변경. 커밋 `9d5f2cf` (+89/-24).
- **Phase 4 — Settings 6 섹션 + 로그아웃 footer 분리 (refactor)**: `SettingsView` 에서 로그아웃 섹션 + 관련 훅 (`clearAuth`, `showConfirm`) 제거. 신규 `SettingsFooter` 가 로그아웃 버튼 + 확인 다이얼로그 (`auth.logout`/`auth.logoutConfirm` 재사용) 담당. `SettingsPage` 가 `SettingsView` 아래에 `SettingsFooter` 배치 → 본문 6 섹션 + 페이지 끝 단독 로그아웃 행. 커밋 `181ce46` (+39/-29).
- **Phase 5 — ProfileEdit / AccountManage 시안 폴리시 (feat)**: `ProfileEditPage` 헤더에 `Goose(happy, 28)` + 프로필 이미지 미설정 시 `Goose(happy, 80)` placeholder. 닉네임 섹션 하단 `@handle` 미리보기 라벨 (`profile.edit.handlePreview`). `AccountManagePage` 헤더에 `Goose(wave, 28)` + `account.manage.title`. `AccountManageView` 가 신규 `AccountCard` 공통 컴포넌트로 카드 추출 + 계정 전환/추가/삭제 버튼 disabled + 준비 중 안내. i18n `profile.edit` 객체화 + `account.*` 신규 키. 커밋 `bfcfbdb` (+137/-57).

### 영향 파일

PinLog-Web:
- `src/widgets/my-page/ui/MyPageView.tsx`
- `src/widgets/my-page/ui/ProfileStatsRow.tsx` (신규)
- `src/widgets/my-page/ui/ProfileTabs.tsx` (신규)
- `src/widgets/my-page/ui/MyPinsGridTab.tsx` (신규)
- `src/widgets/my-page/ui/MyMemoryMapTab.tsx` (신규)
- `src/widgets/my-page/ui/MyCapsuleVaultTab.tsx` (신규)
- `src/widgets/my-page/index.ts`
- `src/widgets/notification/ui/NotificationItem.tsx`
- `src/widgets/notification/lib/moodByKind.ts`
- `src/pages/ActivityPage.tsx`
- `src/widgets/settings/ui/SettingsView.tsx`
- `src/widgets/settings/ui/SettingsFooter.tsx` (신규)
- `src/widgets/settings/index.ts`
- `src/pages/SettingsPage.tsx`
- `src/pages/ProfileEditPage.tsx`
- `src/pages/AccountManagePage.tsx`
- `src/widgets/account-manage/ui/AccountManageView.tsx`
- `src/widgets/account-manage/ui/AccountCard.tsx` (신규)
- `src/shared/lib/i18n/locales/ko.ts`
- `src/shared/lib/i18n/locales/en.ts`
- `src/shared/lib/i18n/locales/ja.ts`

### 알려진 후속

- **MyPage 핀/친구/캡슐 카운트 = 0 placeholder**: my-pins endpoint 부재 + 친구·캡슐 카운트는 로드맵 후속 단계까지 의도적 0 고정. 후속 BE 보강 시 `ProfileStatsRow` props 전환만 필요.
- **MyMemoryMapTab 빈 상태 fallback**: `MapPostFeed` 에 사용자 범위 필터 prop 부재 → 후속 BE my-pins endpoint + `MapPostFeed` `userId` prop 도입 시 재연동.
- **Notification friend kind → `/my` fallback**: 친구 프로필 페이지 (`/profile/:uuid` 등) 도입 시 `actorUuid` 기반 라우팅으로 교체.
- **Notification comment kind `?focus=comments`**: `PostDetailPage` 가 이 쿼리를 실제로 처리하는지 미확인 — 후속 라우트 보강 권장.
- **AccountManageView 계정 전환/추가/삭제**: 본 페이즈는 시각 폴리시만. 실연동은 후속 (스토어 호출부는 disabled 상태로 유지).
- **`ja.ts` i18n drift**: ko/en 대비 누락 키 잔존 — 별도 정리 권장 (본 플랜 범위 외).
- **Lint warnings 9건**: 전부 pre-existing (이전 패치노트 기재) — 별도 정리 플랜 권장.

## v001.8.0

> 통합일: 2026-05-16
> 플랜 이슈: [#46](https://github.com/Team-Pingus/PinLog-Web/issues/46)

### 페이즈 결과

- **Phase 1 — BE 신규 endpoint 2종 (feat)**: Pingus-Server 에 인증된 사용자의 글만 반환하는 `POST /api/post/my` (페이징, `PageResponseDTO<PostVO>` + `totalCount` 자동 포함) 와 `POST /api/post/my-all` (전체, `List<PostVO>`) 신설. Mapper `selectPostsByAccountUuid` / `countPostsByAccountUuid` / `selectAllPostsByAccountUuid` 3종, Service `findMyPosts` / `findAllMyPosts` 2종, Controller 2 핸들러. JWT `auth.getName()` 으로 accountUuid 추출 (기존 create/update/delete 패턴 미러). 기존 `/list`, `/all` 시그니처/응답 미변경. 커밋 `ff37025` (+124/-0) + lint hotfix `c01788a` (+2/-2) — `ApiResponse.error(String)` 의 반환 타입을 `ApiResponse<Void>` → `<T> ApiResponse<T>` 로 제네릭화 (하위 호환 — `Void` 가 유효한 `T`). compileJava 통과.
- **Phase 2 — FE API + hook userId 확장 (feat)**: PinLog-Web `endpoints.ts` 에 `POST.MY_LIST` / `POST.MY_ALL` 추가, `postApi.myList({page,size})` / `postApi.myAll()` 메서드 추가 (인증 필수, `skipAuth` 플래그 생략). `usePostList.ts` 의 두 hook 모두 optional userId 파라미터 확장 — `usePostList(userId?)`, `useInfinitePostList(size, userId?)`. userId truthy 시 my-* queryKey + queryFn 으로 분기, falsy 시 기존. hook 호출 자체는 항상 1회 (queryKey/queryFn 을 호출 전 변수로 사전 계산) → Rules-of-Hooks 안전. 커밋 `9126869` (+31/-7).
- **Phase 3 — MapWithCarousel userId prop (feat)**: `MapWithCarouselProps` 에 `userId?: string` 필드 + JSDoc 추가. `usePostList()` → `usePostList(userId)` 1줄 교체. `MapPostFeed` 미변경 (순수 프레젠테이션 유지). 기존 호출부는 userId 미전달이므로 동작 동일. 커밋 `4d2f970` (+4/-2).
- **Phase 4 — 마이페이지 실데이터 배선 (feat)**: `MyPageView` 가 `useInfinitePostList(12, accountInfo?.uuid)` 호출 후 `data?.pages?.[0]?.totalCount ?? 0` 을 `ProfileStatsRow.pinCount` 에 주입 (`pinCount={0}` 하드코딩 제거). `MyPinsGridTab` 은 `useAuthStore` 에서 uuid 자체 조회 → `useInfinitePostList(12, accountInfo?.uuid)` 로 본인 글만 조회 (동일 query key 캐시 공유 — 중복 fetch 없음). 기존 `posts.length === 0` 분기는 이미 올바르게 구현돼 변경 불필요. `MyMemoryMapTab` 의 EmptyState stub 해제 → `MapWithCarousel userId={accountInfo?.uuid}` 로 본인 핀 지도 연동. 커밋 `0b26c2d` (+19/-7) + 라우트 post-fix `5c76510` (+1/-1) — `onEmptyCta` 의 `/post/create` 가 router 에 부재해 실제 글 작성 경로 `/write` (Router.tsx:67) 로 교체.

### 영향 파일

Pingus-Server:
- `src/main/java/com/pingus/mainserver/controller/PostController.java`
- `src/main/java/com/pingus/mainserver/service/PostService.java`
- `src/main/java/com/pingus/mainserver/mapper/PostMapper.java`
- `src/main/resources/mapper/user/PostMapper.xml`
- `src/main/java/com/pingus/mainserver/dto/ApiResponse.java` (lint hotfix scope expansion)

PinLog-Web:
- `src/shared/api/constants/endpoints.ts`
- `src/features/post/api/postApi.ts`
- `src/features/post/lib/usePostList.ts`
- `src/widgets/map-post-feed/ui/MapWithCarousel.tsx`
- `src/widgets/my-page/ui/MyPageView.tsx`
- `src/widgets/my-page/ui/MyPinsGridTab.tsx`
- `src/widgets/my-page/ui/MyMemoryMapTab.tsx`

### 검증

- BE compile gate: `./gradlew compileJava` exit 0 (Phase 1 hotfix 이후 통과).
- FE lint gate: `pnpm lint` exit 0 / 0 errors / 9 warnings (전부 pre-existing).
- 라우트 검증: `MyMemoryMapTab.onEmptyCta` 경로 `/write` 가 `Router.tsx:67` 의 실제 정의와 일치.
- ApiResponse 제네릭화 안전성: 전 repo 의 `ApiResponse.error` 호출부가 모두 `ResponseEntity<ApiResponse<X>>` body 컨텍스트에서 사용 — 컴파일러 추론으로 `T` 자동 해결, 기존 `Void` 시그니처 호출자(Comment/File/Auth 등) 무영향.

### 알려진 후속

- **`/api/post/all` 및 신규 `/api/post/my-all` 의 unbounded list 응답 패턴**: 핀 수천 보유 사용자에서 잠재 stall. 기존 `/all` 을 그대로 미러링한 결정이므로 본 플랜 범위 밖 — 커서 기반 페이징 또는 viewport-bound 쿼리 도입 후속 권장.
- **`postApi.all()` 호출의 pre-existing 버그**: `apiClient.post<...>(URL, true)` 에서 `true` 가 body 위치로 잘못 전달되는 (skipAuth 플래그 아님) 버그를 Phase 2 sub-agent 가 관찰. 본 페이즈 범위 외 — 후속 fix 권장. 신규 `postApi.myAll()` 호출은 `(URL)` 단일 인자로 호출해 동일 버그 회피.
- **gate-runner (Haiku) 의 exit code 오분류**: Phase 3 lint 실행에서 실제 exit 0 인 결과를 `exit 1` 로 보고. 메인 세션이 직접 `pnpm lint` 재실행으로 검증 후 PASS 처리. gate-runner 신뢰성 보강 후속 권장 (harness 차원).
- **`ApiResponse.error` 제네릭화 scope expansion**: Phase 1 affected_files 에 없던 `ApiResponse.java` 1건을 lint hotfix 중 master "no clarifying questions" 모드 하에서 메인 세션이 자체 승인. 사후 보고 — 변경 1줄, 하위 호환 유지.
- **`MyMemoryMapTab` 의 filter chips / period / scope**: 본 페이즈는 "본인 핀만 지도 표시" 정상 경로까지. `MapFilterChips` 노출/숨김 정책은 후속.

## v001.9.0

> 통합일: 2026-05-16
> 플랜 이슈: [#47](https://github.com/Team-Pingus/PinLog-Web/issues/47)

### 페이즈 결과

- **Phase 1 — `PostDetailPage` `?focus=comments` 처리 (feat)**: 댓글 알림 (NotificationItem comment kind) 이 라우팅하는 `/post/{uuid}?focus=comments` 쿼리를 상세 페이지가 수신해 댓글 영역 자동 스크롤 + 인증 사용자 입력창 포커스 제공. 구현:
  - `PostDetailPage` 가 react-router-dom v7 의 `useSearchParams` 로 `focus` 파라미터를 추출해 `PostDetailView` 에 전달.
  - `PostDetailView` 에 `focus?: string` prop + 3 ref (`commentsRef` 댓글 섹션 wrapper, `commentInputRef` 외부 노출용, `hasFocusedRef` 일회성 가드) + `useEffect` 추가. effect 가 `focus==='comments' && !isLoading && !hasFocused` 조건에서 1회만 발화 — `scrollIntoView({behavior:'smooth', block:'start'})` + `isAuthenticated` 시 `requestAnimationFrame(() => commentInputRef.current?.focus())`. `isLoading` deps 로 데이터 로딩 완료 직후 실행 (early-return 으로 댓글 DOM 미존재 race 회피), one-shot guard 로 `isAuthenticated` 비동기 hydrate 시 중복 발화 방지.
  - `CommentInput` 을 named function export → `forwardRef<{focus: () => void}, CommentInputProps>` 로 마이그레이션 + `useImperativeHandle` 로 외부에 `focus()` 메서드만 노출 + `displayName='CommentInput'` 부여. 내부 `textareaRef` (height auto-adjust) / 모든 props / 렌더 / 이벤트 핸들러 무변경.
  - 커밋 `33bdf75` (+34/-13 across 3 files).

### 영향 파일

PinLog-Web:
- `src/pages/post-detail/PostDetailPage.tsx`
- `src/widgets/post-detail/ui/PostDetailView.tsx`
- `src/widgets/comment-list/ui/CommentInput.tsx`

### 검증

- FE lint gate: `pnpm lint` exit 0 / 0 errors / 9 warnings (전부 pre-existing — 본 패치노트 v001.7.0 부터 기재된 동일 9건).
- 단일 호출자 검증: `CommentInput` 의 forwardRef 마이그레이션 영향 검증 — 실 호출 위치는 `PostDetailView.tsx` 1곳 (`src/widgets/index.ts` 의 re-export 는 passthrough). ref 미전달 호출자는 동작 동일.

### 알려진 후속

- **모바일 키보드 자동 노출**: 일부 모바일 브라우저는 user-gesture 없이 textarea focus 시 가상 키보드를 띄우지 않을 수 있음. 시각적 포커스 표시는 들어가지만 키보드 동시 노출은 OS 정책. 사용자 보고 시 "탭하면 포커스" 폴백 검토.
- **React 19 `forwardRef` legacy 패턴**: 본 패치는 React 18 호환 보수 경로 (`forwardRef + useImperativeHandle`) 채택. React 19 부터는 함수 컴포넌트가 `ref` 를 일반 prop 으로 직접 받을 수 있으므로 향후 코드베이스가 React-19-only 로 표준화될 때 modernize 권장 (low priority).
- (계속 유지) `/all` 및 `/my-all` unbounded 응답 → 페이징 도입 권장.
- (계속 유지) `postApi.all()` pre-existing 인자 위치 버그 (`true` 가 body 위치) fix 권장.
- (계속 유지) gate-runner (Haiku) exit code 오분류 — harness 신뢰성 보강 권장.

## v001.10.0

> 통합일: 2026-05-16
> 플랜 이슈: [#48](https://github.com/Team-Pingus/PinLog-Web/issues/48)

### 페이즈 결과

- **Phase 1 — 기반 (feat)**: 디바이스 멀티 계정 보관소 신설 + 인증 흐름 자동 통합.
  - **NEW `src/features/auth/lib/useSavedAccountsStore.ts`**: zustand `persist` (localStorage key `pinlog-saved-accounts`), `SavedAccount = {uuid, nick, profileImgUrl, accessToken, refreshToken, savedAt}`. 멱등 `saveAccount` (uuid upsert + savedAt 갱신), `removeAccount` (filter), `getAccount`.
  - `src/features/auth/index.ts` + `src/features/auth/lib/index.ts` 양 레이어 re-export 추가 (FSD 패턴, scope expansion 1건 자체 승인).
  - `AccountSelectStep.tsx`: 로그인 성공 분기에 `saveAccount` 멱등 upsert 추가 — 응답 `{accessToken, refreshToken}` flat + 로컬 `accounts.find(...)` 의 `selectedAccount.{uuid, nick, profileImgUrl}`.
  - `AuthPage.tsx`: `useLocation().state.addMode` 도입 — addMode true 시 기존 토큰 리다이렉트 우회, reset 만 호출 (active 토큰 보존).
  - `App.tsx`: 신규 `SavedAccountsBackfill` 컴포넌트 + `<AuthInitializer/><AccountInitializer/><SavedAccountsBackfill/>` 추가 — `useEffect([isAuthenticated, accountInfo])` 로 active 토큰을 saveAccount 멱등 backfill (기존 사용자 첫 진입 시 active 보존).
  - 커밋 `8735dea` (+79/-7 across 6 files).

- **Phase 2 — UI 배선 (feat)**: AccountCard 인터랙션 + AccountManageView 핸들러 + i18n.
  - `AccountCard.tsx`: `onSelect?` / `onRemove?` props 추가. onSelect && !highlighted → 카드 cursor-pointer + onClick + role="button" + tabIndex={0} + Enter/Space 키 핸들. onRemove && !highlighted → 우측상단 ×아이콘 (stopPropagation, aria-label). 기존 display 동작 무변경 (역호환).
  - `AccountManageView.tsx`: `useAuthFlowStore` 의존 완전 제거 → `useSavedAccountsStore.savedAccounts` 기반 재작성. 핸들러 3종 실연동 — 전환 (`tokenStorage.setTokens` + `setAuth` + `setAccountInfo` + `queryClient.clear()` + `navigate('/', {replace:true})`), 추가 (`navigate('/auth', {state:{addMode:true}})`, clearAuth 호출 제거), 삭제 (`showConfirm` → `removeAccount`). 3 global 버튼: 비현재 saved 0개일 때만 disabled, 1개면 즉시 실행, helper text 가 상태에 따라 switchHint/removeHint 전환.
  - i18n ko/en/ja: `account.{switchHint, removeHint, removeConfirmTitle, removeConfirmMessage}` 4 키 신규 + 미사용 `account.preparing` 제거.
  - 커밋 `999b98e` (+82/-42 across 5 files).

### 영향 파일

PinLog-Web:
- `src/features/auth/lib/useSavedAccountsStore.ts` (NEW)
- `src/features/auth/index.ts`
- `src/features/auth/lib/index.ts`
- `src/widgets/auth-flow/ui/AccountSelectStep.tsx`
- `src/pages/AuthPage.tsx`
- `src/app/App.tsx`
- `src/widgets/account-manage/ui/AccountCard.tsx`
- `src/widgets/account-manage/ui/AccountManageView.tsx`
- `src/shared/lib/i18n/locales/ko.ts`
- `src/shared/lib/i18n/locales/en.ts`
- `src/shared/lib/i18n/locales/ja.ts`

### 검증

- FE lint gate: `pnpm lint` exit 0 / 0 errors / **10 warnings** (Phase 1 에서 +1, AuthPage.tsx:21 exhaustive-deps — 코드베이스 기존 9건과 동일 패턴, tech-debt 일괄 정리는 후속).
- `@shared` re-export 확인: `queryClient` (line 53), `getTokenStorage` (line 56) 모두 정상 export — Phase 2 import 안전.
- 토큰 swap 호출 순서 검증: storage → store (`setAuth` + `setAccountInfo`, 동기 setState 묶음) → cache clear → navigate. `accountInfo === null` 일시 윈도우는 동기 핸들러 내에서 0 frame.

### 알려진 후속

- **다중 refresh-token localStorage 표면적**: 단일 토큰 대비 N 배 표면적 (위협 모델은 동일 — XSS 시 모두 노출). httpOnly cookie 전환 검토 권장 (medium priority).
- **전환 / 삭제 global 버튼의 silent no-op (>1 non-current)**: helper text 로 mitigation 되지만 진짜 picker UI 또는 button truly disabled 가 더 명확. 후속 UX 보강 권장 (low priority).
- **`AuthPage.tsx:21` exhaustive-deps 경고 1건 추가**: 코드베이스의 기존 9건과 동일 패턴 (`navigate`/`reset`/`tokenStorage` stable refs). tech-debt 일괄 정리 후속 권장.
- (계속 유지) 모바일 키보드 자동 노출 OS 정책 폴백 (low priority).
- (계속 유지) React 19 forwardRef legacy modernize (low priority).
- (계속 유지) `/all` 및 `/my-all` unbounded 응답 → 페이징 도입 권장.
- (계속 유지) `postApi.all()` pre-existing 인자 위치 버그 (`true` 가 body 위치) fix 권장.
- (계속 유지) gate-runner (Haiku) exit code 오분류 — harness 신뢰성 보강 권장.

## v001.11.0

> 통합일: 2026-05-16
> 플랜 이슈: [#48](https://github.com/Team-Pingus/PinLog-Web/issues/48) (hotfix1)

### 페이즈 결과

- **Hotfix1 — 후속 권장 일괄 처리 (FE/Pinlog 범위) (fix)**: v001.10.0 의 8건 후속 권장 중 FE/Pinlog 스코프 5건을 단일 hotfix WIP 에서 처리. 커밋 `a9a9dcf` (+42/-29 across 16 files) + `00c7231` (eslint-disable directive 재배치, +2/-2 across 2 files).

  **A. AccountManageView silent button 해소**: 전환/삭제 global 버튼의 `disabled={length === 0}` → `disabled={length !== 1}`. 정확히 1개 non-current 일 때만 enabled. helper text 분기 단순화 (`length === 0` → `account.addHint`, `length > 0` → `switchHint`). ko/en/ja `account.addHint` 신규 키.

  **B. exhaustive-deps 10건 → 0건**: AuthPage / Dialog / HomeListLayout / LocationPicker / BottomNav / MapWithCarousel / PostList 등 8 파일 useEffect/useMemo deps 정리. 2건 (ProfileEditPage:36, MapPostFeed:158) 은 무한 렌더 / SDK 재초기화 위험으로 `eslint-disable-next-line` directive (의도적 보존, 사유 주석 + deps 라인 직전 정확 배치). 결과: `pnpm lint` 0 errors / **0 warnings**.

  **C. postApi.all() 인자 위치 버그**: `apiClient.post<...>(URL, true)` 의 `true` 가 body 위치로 잘못 전달되던 버그를 `(URL, undefined, true)` 로 수정해 `skipAuth` 의도 복원.

  **D. PostDetailView 모바일 키보드 폴백**: 댓글 wrapper div 에 `onClick={() => commentInputRef.current?.focus()}` 추가 — user-gesture 로 OS 키보드 트리거. v001.9.0 의 `?focus=comments` 흐름 보강.

  **E. CommentInput React 19 ref-as-prop 모던화**: `forwardRef` 래퍼 제거, 함수 컴포넌트가 `ref` 를 일반 prop 으로 수신. `useImperativeHandle(ref, ...)` 본문 유지.

### 영향 파일

PinLog-Web:
- `src/widgets/account-manage/ui/AccountManageView.tsx` (A)
- `src/pages/AuthPage.tsx` (B-1)
- `src/pages/ProfileEditPage.tsx` (B-2, eslint-disable)
- `src/shared/ui/Dialog.tsx` (B-3)
- `src/widgets/home-list/ui/HomeListLayout.tsx` (B-4)
- `src/widgets/location-picker/ui/LocationPicker.tsx` (B-5)
- `src/widgets/main-layout/ui/BottomNav.tsx` (B-6)
- `src/widgets/map-post-feed/ui/MapPostFeed.tsx` (B-7, eslint-disable)
- `src/widgets/map-post-feed/ui/MapWithCarousel.tsx` (B-8)
- `src/widgets/post-list/ui/PostList.tsx` (B-9)
- `src/features/post/api/postApi.ts` (C)
- `src/widgets/post-detail/ui/PostDetailView.tsx` (D)
- `src/widgets/comment-list/ui/CommentInput.tsx` (E)
- `src/shared/lib/i18n/locales/{ko,en,ja}.ts` (A 신규 키)

### 검증

- FE lint gate: `pnpm lint` exit 0 / **0 errors / 0 warnings** (직전 baseline = 10 → 0, 코드베이스 첫 lint-clean 도달).

### 처리 / 미처리 매핑

- **처리 완료 5/8** (FE/Pinlog scope): #2 silent buttons, #3 exhaustive-deps 일괄, #4 모바일 키보드 폴백, #5 React 19 modernize, #7 postApi.all() 버그.
- **미처리 3/8 — 별도 plan-enterprise 필요**:
  - **#1 httpOnly cookie 전환**: BE 토큰 응답 + axios interceptor + 세션 정책 동시 변경 — BE+FE plan.
  - **#6 `/all` 및 `/my-all` unbounded 페이징**: BE endpoint 시그니처 변경 + FE 호출 사이트 마이그레이션 — BE+FE plan.
  - **#8 gate-runner Haiku exit code 오분류**: Project-I2 harness `gate-runner` sub-agent 작업 — `plan-enterprise-os` 또는 별도 harness fix.

### 알려진 후속 (carry-over)

- (carry-over) #1 httpOnly cookie 전환 — 다중 refresh-token localStorage 표면적 해소 (medium priority).
- (carry-over) #6 `/all` / `/my-all` unbounded 응답 → 페이징 (medium priority).
- (carry-over) #8 gate-runner Haiku exit code 오분류 — harness 신뢰성 보강 (low priority).
- v001.10.0 의 신규 후속 3건 (silent buttons / exhaustive-deps / AuthPage:21 추가 경고) + v001.9.0 의 2건 (모바일 키보드 / React 19 forwardRef) 모두 본 패치에서 해소.
