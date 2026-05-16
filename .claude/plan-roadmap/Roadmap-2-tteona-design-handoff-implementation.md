# Roadmap 2: Tteona 디자인 핸드오프 구현 (FE 우선, BE 필요 시점 보강)

> 작성일: 2026-05-15 | 대상: Tteona 그룹에서 디자인팀 v3.2 핸드오프 (46 아트보드 / 33 모바일 화면) 를 Next.js 16 + React 19 앱으로 구현 완료. BE 는 화면 plan 내부에서 필요한 만큼 보강.

## 프롬프트

🟢 /plan-enterprise Tteona 단계0 인프라 — sketch.css 토큰 (--secondary-soft / --accent-soft / --warn-soft / --overlay-dim) 의 globals.css 이관 + grep ≥ 2 검증, src/app 라우트 그룹 골격 ((auth) / (buyer) / (seller) / (system) / (social)), AppShell + BottomTabBar + TopBar, API 클라이언트 (fetch wrapper, env zod 검증, 세션 헤더, retry/timeout), Tteona-server origin CORS·쿠키 호환성 검증 phase 포함. BE 변경 0 가정으로 시작하되 CORS 미충족 시 같은 plan 안에 BE 설정 보강 phase 추가. (이슈 bj-kim-funshare/Tteona#1, patch-note v001.2.0, 2026-05-15 완료)

🔴 /dev-inspection Tteona today

🟢 /plan-enterprise Tteona 단계1 v3 공유 디자인 프리미티브 라이브러리 — src/components/trust 신설 (TrustCard A/B, TierBadge 3-tier, TapTarget 44 wrapper, PersonaChipRow, PersonaOverlay, ReportFlagBtn) + src/components/itinerary 의 StructuredDay, DaySummaryRow, BlurredPreview, TimelineAutoDraft 까지. 핸드오프 components/v3-trust.jsx + v3-detail-patches.jsx 를 React 19 + TypeScript 로 포팅. 단일 plan phase 직렬 (components/trust + components/itinerary 가 같은 디렉터리 트리에서 토큰·아이콘 공유). (이슈 bj-kim-funshare/Tteona#4, patch-note v001.4.0, 2026-05-15 완료)

🔴 /dev-inspection Tteona today

🟢 /plan-enterprise Tteona 단계2 인증 통합 — src/app/(auth)/{login, signup, social-callback, forgot-password} 라우트 + 기존 legal 레이어 (SocialLoginV2 / LegalProvider) 연결 + Tteona-server /auth/* (social login + consent S2.1/S1.5) 결합. 첫 phase 에서 BE 라우트 구현 충실도 점검 후 미흡 시 같은 plan 내부 BE 보강 phase 추가. (이슈 bj-kim-funshare/Tteona#5, patch-note v001.5.0, 2026-05-15 완료)

🔴 /dev-security-inspection Tteona today

🟢 /plan-enterprise Tteona 단계3-A 바이어 홈/탐색/피드/검색/필터 — src/app/(buyer)/{home, feed, search, filter, explore} 5 화면 + src/components/feed (FeedCard A/B, PersonaOverlay 적용), src/components/explore (handoff explore-cards.jsx 포팅), src/components/filter. Tteona-server feed 라우트 결합 — 미구현 항목은 같은 plan phase 로 BE 보강. (이슈 bj-kim-funshare/Tteona#6, patch-note v001.6.0, 2026-05-15 완료)

🔴 /plan-enterprise Tteona 단계3-B 바이어 상세/결제/구매완료/환불요청 — src/app/(buyer)/{detail/[id], pay/[id], purchase-done/[id], refund/request/[id]} 라우트 + src/components/trip (Detail_v3 A/B/C 변종 + Blur_B_v3 + TrustCard 통합), src/components/checkout (Pay_B_Legal 통합), src/components/refund (Aft_A_Legal 통합). Tteona-server transactions + refunds 결합. accent → warn 컬러 마이그레이션 (환불 액션) 포함.

🔴 /dev-inspection Tteona today

🔴 /dev-security-inspection Tteona today

🔴 /plan-enterprise Tteona 단계3-C 바이어 여정 — src/app/(buyer)/{trip-active, itinerary-map, my-trips, orders} + src/components/itinerary 의 TimelineAutoDraft 자동 초안 슬롯 (도입 / Day 요약 / 장소 한마디 3 슬롯 placeholder, 잠금 영역 자물쇠 유지). Tteona-server itineraries CRUD + /publish (tier 재계산) 결합.

🔴 /plan-enterprise Tteona 단계3-D 바이어 마이/리뷰/위시리스트/알림 — src/app/(buyer)/{profile/me, review/write/[orderId], wishlist, notifications} + src/components/review, src/components/notification. Tteona-server reviews + notifications 결합.

🔴 /dev-inspection Tteona today

🔴 /project-verification Tteona today

1️⃣ 🔴 /plan-enterprise Tteona 단계4-A 셀러 셋업·대시보드 — src/app/(seller)/{verification, build-listing, dashboard, analytics, payouts, sales-recipes} + src/components/seller (handoff seller-flow.jsx 포팅). Tteona-server itineraries publish + transactions analytics + payouts 결합.

1️⃣ 🔴 /plan-enterprise Tteona 단계4-B 셀러 메신저·공개 프로필 — src/app/(seller)/{chat, chat/[threadId], public-profile/[sellerId]} + src/components/messaging. Tteona-server 메시징 라우트가 부재하면 같은 plan 안 BE 신설 phase 포함.

🔴 /dev-inspection Tteona today

🔴 /dev-security-inspection Tteona today

🔴 /plan-enterprise Tteona 단계5 시스템·소셜 — src/app/(system)/{settings, help, refund/list} + src/app/(social)/{region-feed, seller/[sellerId]} 를 단일 plan 의 phase 직렬 (라우트 가드·하단 탭 공유). Tteona-server reports + reviews + region feed 라우트 결합·보강.

🔴 /dev-inspection Tteona today

🔴 /plan-enterprise Tteona 단계6 빈/에러/로딩 + PWA 마감 — handoff 5 종 (Empty / Error / Loading / Skeleton / Offline) 을 src/components/states 로 통합 + 모든 라우트 적용, next-pwa service worker · manifest · 오프라인 fallback, prefers-reduced-motion · TapTarget 44 일괄 감사, WCAG AA · 4.5:1 metadata 일괄 감사, 토큰 grep ≥ 2 회귀 검증. BE 변경 0.

🔴 /dev-inspection Tteona today

🔴 /dev-security-inspection Tteona today

🔴 /project-verification Tteona today

🔴 /pre-deploy Tteona

🔴 /patch-confirmation Tteona

---

## 로드맵 설명

### 목적

디자인팀이 v3.2 까지 마감한 핸드오프 (46 아트보드, 33 모바일 화면, 공유 프리미티브 9 종, 토큰 4 종 보강) 를 Tteona FE (Next.js 16 + React 19) 에 실제 라우트·컴포넌트·상태·테스트로 구현. 현재 FE 는 legal 레이어 + 토큰 + Query client 만 있고 trip / itinerary / marketing / checkout / common 디렉터리는 비어 있어 사실상 0 → 1 구축. Tteona-server 는 도메인 라우트 골격만 있어 화면 결합 시점에 부족한 부분을 같은 plan 내부 phase 로 메꾼다 (BE 우선 마감하지 않음 — FE-driven).

### 구성 개요

총 7 단계, 11 개 `/plan-enterprise` + 단계간 품질 게이트 + pre-deploy + patch-confirmation.

- **단계 0** — 토큰·라우트 골격·AppShell·API 클라이언트·CORS 검증. 후속 모든 단계의 전제.
- **단계 1** — v3 공유 프리미티브 라이브러리 (TrustCard / TierBadge / TapTarget / PersonaChipRow / PersonaOverlay / StructuredDay / TimelineAutoDraft / ReportFlagBtn). 단일 plan phase 직렬 — 단계 3~5 의 거의 모든 화면이 의존.
- **단계 2** — 인증 통합 (legal 레이어 + /auth/* 결합). 보안 민감 → 직후 security inspection.
- **단계 3** — 바이어 플로우 15 화면. 4 개 plan (3-A 홈/탐색, 3-B 상세/결제/환불, 3-C 여정, 3-D 마이/리뷰) **순차** 진행. AppShell · BottomTabBar · 공유 hooks · React Query cache key 가 얽혀 병렬 시 i-dev 머지 충돌 위험이 크므로 직렬 강제 (data-craft Roadmap-1 의 데이터 뷰어 5 종 단일 plan 직렬 결정과 동일 패턴).
- **단계 4** — 셀러 플로우 9 화면. **병렬 그룹 1** — 4-A 셋업·대시보드 (src/app/(seller)/{verification, build-listing, dashboard, analytics, payouts, sales-recipes} + components/seller) 와 4-B 메신저·공개 프로필 (src/app/(seller)/{chat, public-profile} + components/messaging) 은 라우트·컴포넌트 영역이 명확히 분리되어 병렬 안전.
- **단계 5** — 시스템 (settings / help / refund 목록) + 소셜 (region-feed / 셀러 공개 프로필) 단일 plan phase 직렬. 라우트 가드 + 하단 탭 공유.
- **단계 6** — 빈/에러/로딩 5 종 + PWA (service worker, offline fallback, manifest) + 접근성·토큰 회귀 감사.
- **단계 7** — `/pre-deploy Tteona` + `/patch-confirmation Tteona` 로 마감.

### 품질 게이트 배치

- 단계 0 / 1 / 3-B 전반 / 3 종료 / 4 종료 / 5 / 6 후 — `/dev-inspection Tteona today`
- 인증 (단계 2) / 결제·환불 (단계 3-B) / 메신저 (단계 4 종료) / PWA (단계 6) 후 — `/dev-security-inspection Tteona today`
- 단계 3 종료 + 단계 6 종료 — `/project-verification Tteona today`

품질 게이트가 BLOCK 이슈를 만들면 plan-enterprise 가 자동으로 hand-off 받으므로 본 로드맵엔 보강 프롬프트를 미리 박지 않는다.

### 위험·결정 사항

- **BE 충실도 불확실성** — Tteona-server 도메인 라우트가 골격만 있을 가능성. 각 화면 plan 의 첫 phase 에서 해당 도메인 BE 라우트 가용성을 점검하고, 미흡 시 같은 plan 안에서 BE 보강 phase 를 추가하는 방식 (마스터 결정 — FE 우선, BE 필요 시점에만).
- **공유 컴포넌트 의존 순서** — 단계 1 의 프리미티브가 마감되지 않으면 단계 3~5 가 placeholder 로 시작해 후행 리팩터 부담. 단계 1 직후 dev-inspection 게이트로 회귀 차단.
- **바이어 4 plan 직렬 강제** — AppShell / BottomTabBar / React Query cache key / 공유 hooks (useConsent 등) 가 4 개 plan 모두에서 건드려질 수 있어 병렬 시 i-dev 머지 시점 충돌 다발. 의도적 직렬화.
- **컬러 시맨틱 회귀 위험** — design-notes-v3 §v3.2 의 `accent → warn` 마이그레이션 (환불 액션) 이 단계 3-B 에서 일어남. 단계 6 회귀 감사 시 `accent` 사용처 grep 으로 할인·온도 외 누락 확인.
- **카카오 #FEE500 토큰 외 예외 1 건 유지** — 카카오 OAuth 버튼만 허용. 단계 2 와 단계 6 양쪽에서 회귀 점검.
- **PWA 디바이스 권한 범위** — 단계 6 의 PWA 는 service worker + offline cache + manifest 까지. Web Push / 카메라 / 파일 시스템 접근은 본 로드맵 범위 밖 (별도 로드맵 또는 Flutter 쉘 통합 시).

### 작업 범위 (Roadmap-2 포함 / 제외)

| 항목 | Roadmap-2 |
|---|---|
| Tteona FE 33 모바일 화면 구현 | O |
| v3 공유 프리미티브 9 종 라이브러리화 | O |
| Tteona-server BE 보강 (FE 화면 결합 필요분만) | O |
| 토큰·접근성·TapTarget·컬러 시맨틱 회귀 감사 | O |
| next-pwa service worker / offline cache / manifest | O |
| Web Push / 디바이스 카메라 / 파일 시스템 / 딥링크 | — |
| 네이티브 / Flutter 쉘 / 앱 스토어 배포 | — |
| BE 전면 재구축 (FE 결합 외 도메인) | — |
| 디자인 v4 변경 흡수 (가정 v3.2 동결) | — |

### 종료 조건

- 11 개 `/plan-enterprise` issue 모두 close.
- 마지막 `/pre-deploy Tteona` 합격 보고서 발행.
- `/patch-confirmation Tteona` origin push 완료.
- 본 파일의 모든 프롬프트 상태가 🟢 로 갱신 (마스터 plan-roadmap edit 모드 수동 갱신).
