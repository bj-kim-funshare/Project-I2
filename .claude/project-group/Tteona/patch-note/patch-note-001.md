# Tteona — Patch Note (001)

## v001.11.0 — Detail variant 정식 분배 메커니즘 (middleware FNV-1a 해시 + clientId 1y/variant 30d 쿠키 + analytics hook)

> 통합일: 2026-05-16
> 플랜 이슈: bj-kim-funshare/Tteona#11

### 페이즈 결과

- **Phase 1** (feat, Tteona): variant 분배 인프라. `src/lib/env.ts` 에 `NEXT_PUBLIC_DETAIL_VARIANT_WEIGHTS` (기본 `'33,33,34'`) 추가. `src/lib/variant/` 4 모듈 신설 — `types.ts` (DetailVariant 타입 + DETAIL_VARIANTS), `cookie-names.ts` (`tteona_detail_variant` / `tteona_client_id` 단일 진실원천), `weights.ts` (`parseWeights` + env-driven `getDetailVariantWeights()` — v2 BE 교체 지점), `hash.ts` (FNV-1a 32-bit 결정적 해시 + 가중치 누적 비교 `assignVariant`). `src/middleware.ts` body 교체 — `/detail/*` path guard, QA override (`?variant=A|B|C`) 통과, clientId 1y / variant 30d 쿠키 발급. `.env.example` 추가. Edge runtime 호환 확인. 커밋 `cda1c8f`.
- **Phase 2** (feat, Tteona): analytics hook + BFF 로깅. `src/lib/analytics/track.ts` (AnalyticsEvent 타입 + `track()` + `trackVariantView()` fire-and-forget keepalive). `src/lib/analytics/use-track-variant-view.ts` (`useRef` 키 가드 client hook). `src/app/api/analytics/events/route.ts` POST 핸들러 (body 검증 invalid_json/invalid_event 400, 정상 시 `console.info('[analytics] variant_view', {...})` + 200 ok). 커밋 `634901e`.
- **Phase 3** (refactor, Tteona): `/detail/[id]` 결선. `src/lib/variant/read-variant-cookie.ts` 신설 (`document.cookie` SSR-safe read). `src/app/(buyer)/detail/[id]/page.tsx` 의 기존 `parseVariant` (폴백 'A') 를 `parseQueryVariant` (null 반환) 로 교체, `useState` 초기값 + `useEffect` cookie read 패턴으로 쿼리 → 쿠키 → 'A' 폴백 우선순위. `useTrackVariantView(id, variant)` 호출. `'use client'` page 라 wrapper 컴포넌트 불필요. 커밋 `2adafb1`.
- **Phase 3 fix** (refactor, Tteona): `useTrackVariantView` race 해소. 기존 `useRef<boolean>` 단순 플래그가 variant 전이 시 재발신 차단 → `useRef<string|null>` 키 비교 (`${detailId}:${variant}`) 로 교체. 첫 렌더 'A' 후 쿠키 'B' 적용 시 'B' 도 정상 발신. Strict Mode 동일 키는 여전히 no-op. 커밋 `5768046`.

### 영향 파일

Tteona:
- src/lib/env.ts
- src/lib/variant/types.ts (신규)
- src/lib/variant/weights.ts (신규)
- src/lib/variant/hash.ts (신규)
- src/lib/variant/cookie-names.ts (신규)
- src/lib/variant/read-variant-cookie.ts (신규)
- src/middleware.ts
- .env.example
- src/lib/analytics/track.ts (신규)
- src/lib/analytics/use-track-variant-view.ts (신규)
- src/app/api/analytics/events/route.ts (신규)
- src/app/(buyer)/detail/[id]/page.tsx

### 그룹 정책 준수 기록

- `db.md` 외부 소유 정책 무관 (FE 전용 플랜, DDL/마이그레이션 0건).
- 신규 의존성 0건 — `jose` JWT 디코드 회피, `crypto.randomUUID` Edge 내장, FNV-1a 순수 함수 직접 구현.
- Lint 게이트 `pnpm lint` 모든 페이즈 PASS (0 errors, 11 pre-existing warnings 유지).
- advisor #1 + #2 모두 5관점 PASS, BLOCK 없음.

### 핵심 설계 결정

- **해시 시드 = `tteona_client_id` (단일, 1y persistent)**: 마스터 "사용자 ID 또는 익명 ID" 직역과 차이. FE 단독 user-stable identifier 로 가장 적합 (JWT 디코드 회피 + 익명↔로그인 전이 불연속 회피). 단점: cross-device 분배 stable 아님 — v2 BE assignment 트랙으로 강화.
- **분배 결정 위치 = Next.js middleware**: server component 단독 결정은 cookie 발급 불가 (RSC 제약). middleware 가 표준. Edge runtime 에서 `crypto.randomUUID()` + FNV-1a 모두 호환.
- **QA override (`?variant=X`) = cookie 미갱신**: 쿼리 진입 시 일회성 override, persistent variant 분배에 영향 없음.
- **Analytics = thin abstraction**: v1 은 console.info 서버 로깅만. 실 provider 연결은 follow-up.

### Spec drift / 운영 주의

- **page.tsx 의 `react-hooks/set-state-in-effect` lint 규칙 우회**: `eslint-disable-next-line` 으로 억제. 근본 해결은 `useSyncExternalStore` 기반 쿠키 구독 리팩터 — v2 후속.
- **race-fix 의 "최대 2회 발신" 부수효과** (5768046): cookie-read 가 늦으면 'A' (초기 렌더) → 'B' (cookie 적용) 두 이벤트가 발신될 수 있음. v1 은 console.info 로깅뿐이라 실측 영향 없음. 진짜 analytics provider 연결 시 "마지막 노출 = 최종 variant" 집계 규칙 또는 cookie pre-resolve 패턴 (useSyncExternalStore) 으로 보강 필요.
- **Phase 3 scope expansion (iter 2/3 사용)**: tracking race 발견 시 Phase 2 파일 (use-track-variant-view.ts) 을 Phase 3 affected_files 로 임시 확장하여 fix. analytics 정확성 보장이 plan 의도와 정합하다는 main session 판단.

### 외부 의존 / 후속

- **실 analytics provider (PostHog/Amplitude/GA) 연결** — Phase 2 가 인터페이스만, provider 결정 + SDK 통합은 별도 플랜.
- **BE 측 가중치 제어 엔드포인트** — `getDetailVariantWeights()` 의 BE 교체 지점만 인터페이스로 마련, BE 신설은 별도.
- **userId-stable seed (JWT sub claim)** — v2. BE 가 assignment 결정 후 cookie 발급하는 라우트 도입으로 cross-device stable 가능.
- **익명→로그인 전이 시 variant 연속성 보강** — v2.
- **useSyncExternalStore 기반 쿠키 구독 리팩터** — lint 우회 제거 + race-fix 의 "최대 2회 발신" 부수효과 제거. v2 후속.

### 마스터 수동 검증 sequence

1. `/detail/123` (쿠키 없음) 진입 → response `Set-Cookie` 에 `tteona_detail_variant=A|B|C` + `tteona_client_id=<uuid>` 발급 확인.
2. 재방문 시 동일 variant 유지 (5회 reload 모두 동일).
3. env `NEXT_PUBLIC_DETAIL_VARIANT_WEIGHTS=0,0,100` → 항상 `C` 발급 확인.
4. `/detail/123?variant=B` 직접 진입 → variant=B 렌더 + 쿠키 미갱신 (QA override).
5. `fetch('/api/analytics/events', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'variant_view', detailId:'x', variant:'A'})})` → 200 + 서버 로그 `[analytics] variant_view {...}`.
6. race-fix 검증 (쿠키 미설정 → 진입): network 탭에 `POST /api/analytics/events` 최대 2회 (A→B), 마지막 'B'.

## v001.10.0 — refunds approve/complete 흐름 + transactions.status 동기화 (admin-gated 2 엔드포인트 + env allowlist 권한 모델)

> 통합일: 2026-05-16
> 플랜 이슈: bj-kim-funshare/Tteona#10

### 페이즈 결과

- **Phase 1** (feat, Tteona-server): admin 게이트 + service 함수 도메인 로직. `src/lib/config.ts` 에 `ADMIN_USER_IDS` env (콤마구분 UUID list) + 파싱된 `adminUserIds` 배열 export. `src/middleware/admin-auth.ts` 신규 — `requireAdmin()` 미들웨어가 `c.get('userId')` 를 `adminUserIds` 와 비교하여 401(unauthenticated) / 403(non-admin) / next(admin) 분기. `src/lib/refunds/service.ts` 에 `approveRefund(tx, refundId)` (requested→approved 전이 + approvedAt 기록) + `completeRefund(tx, refundId, outcome, failedReason?)` (approved→completed|failed 전이; outcome='completed' 시 같은 tx 안에서 `transactions.status='refunded'` + `transactions.refundedAt` 원자 갱신; outcome='failed' 시 `refunds.failedReason` 기록 + transactions 미변경) 추가. 결과 enum 4종 (`ok` / `not_found` / `invalid_state` / `missing_failed_reason`). `src/lib/validation/refunds.ts` 에 `refundParamsSchema` + `completeRefundBodySchema` 추가. `.env.example` `ADMIN_USER_IDS=` 추가. DDL 변경 0건. 커밋 `81ca3ba`.
- **Phase 2** (feat, Tteona-server): admin 라우트 모듈 + 마운트. `src/routes/admin/refunds.ts` 신규 — `adminRefundsRoute.use('*', requireAdmin())` + `POST /:id/approve` (params 검증 → `approveRefund` → enum→HTTP 매핑: ok=200, not_found=404, invalid_state=409+`current_status`) + `POST /:id/complete` (params + `completeRefundBodySchema` 검증 → `completeRefund` → 매핑: ok=200, not_found=404, invalid_state=409, missing_failed_reason=400). 핸들러는 `db.transaction((tx) => fn(tx, ...))` 패턴으로 service-role tx 를 service 에 전달. `src/app.ts` mount 순서: `/webhooks` → `/admin/*` authMiddleware 단독 → `/admin/refunds` 라우트 → 전역 authMiddleware + dbContext → 기존 routes. admin 엔드포인트가 JWT 인증은 받되 RLS dbContext 는 우회. 커밋 `62d6e51`.

### 영향 파일

Tteona-server:
- src/lib/config.ts
- src/middleware/admin-auth.ts (신규)
- src/lib/refunds/service.ts
- src/lib/validation/refunds.ts
- .env.example
- src/routes/admin/refunds.ts (신규)
- src/app.ts

### 그룹 정책 준수 기록

- `db.md` "정규 스키마는 외부(Huya) 소유, 본 그룹은 DDL 미발행" 준수 — schema 변경 0, 마이그레이션 0. admin 식별은 `.env` `ADMIN_USER_IDS` allowlist (Huya `users` 테이블의 `role` CHECK 가 `('buyer','seller','both')` 만 허용해 `'admin'` 추가 불가, `is_admin` 컬럼 추가도 외부 의존). RLS 회피도 코드-level mount 우회로 — `refunds_admin_*` / `transactions_admin_update` RLS 정책 추가 같은 Huya 의존 0.
- Lint 게이트: `pnpm typecheck` 두 페이즈 모두 PASS.
- advisor #1 + #2 모두 5관점 PASS, BLOCK 없음.

### 핵심 설계 결정

- **Admin auth = env allowlist (DDL 회피)**: application-level admin allowlist 가 본 플랜의 단일 보안 경계. `ADMIN_USER_IDS` 누락(빈 env) 시 모든 admin endpoint 403 — fail-closed. 운영 배포 시 env 주입 누락이 라이브 환경에서 admin 작업 차단으로 이어질 수 있어 배포 체크리스트 항목 surface.
- **RLS bypass = mount 순서로 코드 우회**: admin 라우트를 글로벌 `dbContext` **이전**에 mount + `db.transaction()` 직접 사용 (service-role). 기존 `refunds_buyer_*` RLS 정책이 buyer-scoped 이라 admin UUID 가 `app.user_id` 에 박히면 0 rows 로 조용한 실패하는 구조적 위험을 우회. 동일 패턴이 `/webhooks/stripe` (Stripe plan #9) 에서 이미 채택됨.
- **complete(outcome='failed') 는 terminal**: 기존 `createRefund` 의 `already_refunded` 차단으로 buyer 재요청 경로 없음. v1 결정 — 재요청 필요 시 admin 수동 처리. v2 후속: `createRefund` 가 prior failed 행을 새 요청으로 대체 허용.

### 외부 의존 / 후속

- **Admin allowlist 운영성**: env 기반은 단순하나 admin 추가/제거가 배포 필요. v2 에서 admin role 정식화(Huya `users.role` enum 확장 + JWT `role` claim) 후속.
- **Failed refund 재요청 경로 부재**: v2 에서 `createRefund` 로직에 `prior_failed` 분기 추가 검토.
- **72h 자동 환불 batch job**: v2 별도 페이즈 (본 플랜 명시적 분리).
- **mount 순서 회귀 감시**: 글로벌 미들웨어보다 admin scope 미들웨어를 먼저 등록하므로 mount 순서가 정확해야 한다. 잘못 배치 시 admin 라우트가 글로벌 dbContext 에 잡혀 RLS 차단 회귀 — 운영 검증 sequence 가 잡음.

### 마스터 수동 검증 sequence

1. (사전) buyer 가 `POST /refunds` → 201, `status='requested'` (기존 회귀 검증).
2. admin JWT 로 `POST /admin/refunds/:id/approve` → 200, `status='approved'` + `approvedAt`.
3. admin JWT 로 `POST /admin/refunds/:id/complete` body `{ outcome: 'completed' }` → 200, refund `completed`, transactions `refunded` + `refundedAt` 원자 동기.
4. 다른 refund 에 `outcome: 'failed', failedReason: '...'` → 200, refund `failed` + `failedReason`, transactions 미변경.
5. 다른 buyer JWT 로 admin endpoint → 403.
6. requested 상태에서 바로 complete → 409 `INVALID_STATE_TRANSITION`.

## v001.9.0 — Stripe 결제 게이트웨이 통합 v1 (BE PaymentIntent + webhook 70/30 split + FE Stripe Elements 결선)

> 통합일: 2026-05-16
> 플랜 이슈: bj-kim-funshare/Tteona#9

### 페이즈 결과

- **Phase 1** (feat, Tteona-server): `stripe` v22.1.1 의존성 추가 + `src/lib/stripe/client.ts` 신설(SDK 싱글턴 + `constructStripeEvent` 헬퍼). `src/lib/config.ts` 에서 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` 을 optional → required 로 전환. `src/lib/transactions/service.ts` 에 `createPendingTransactionWithIntent(tx, payload)` 추가 — RLS-aware `c.get('tx')` 위에서 `transactions` 행 INSERT(`status='pending'`, 기존 컬럼만), 직후 `metadata.transactionId` 포함 Stripe PaymentIntent 생성(`idempotencyKey` 적용). `POST /api/transactions` 핸들러 신설 — zod 검증, 비카드 메서드는 400 `PAYMENT_METHOD_UNSUPPORTED`, 응답 `{ transactionId, clientSecret }`. 커밋 `35380e2`.
- **Phase 2** (feat, Tteona-server): `src/routes/webhooks/stripe.ts` 신설 — `c.req.raw.text()` 로 raw body 보존 + `stripe-signature` 헤더 + `constructStripeEvent` 로 서명 검증. 이벤트 분기: `payment_intent.succeeded` → `finalizePaidTransaction` 호출(70/30 split: `platformFeeKrw = floor(gross * 0.30)`, `sellerPayoutKrw = gross - platformFeeKrw - stripeFeeKrw`, `stripeFeeKrw` 는 `stripe.charges.retrieve(latest_charge, {expand:['balance_transaction']}).balance_transaction.fee` 에서 도출), `stripeChargeId` 멱등 가드. `payment_intent.payment_failed` → `markTransactionFailed` 호출(status 전환 + 실패 사유는 pino warn 로그). `src/app.ts` 에서 `/webhooks` 라우트를 `authMiddleware` / `dbContext` 이전에 마운트(서비스-role 통과). 커밋 `dd3e05d`.
- **Phase 3** (feat, Tteona): `@stripe/react-stripe-js` 설치. `src/lib/stripe/client.ts` 신설(`loadStripe` 싱글턴, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` 환경변수 검증). `Pay_B_Legal.tsx` 2단계 플로우로 재설계 — 1단계: 카드 수단 선택 + VoluntaryCheck 동의 후 `onPrepare` 콜백 → 부모가 `POST /api/transactions` 실행 → 2단계: `clientSecret` 수신 시 `<Elements>` + `<PaymentElement />` 마운트, 내부 `CardPaymentForm` 에서 `stripe.confirmPayment` 로 최종 결제. 비카드 수단(KakaoPay/TossPay/Apple Pay) 은 `disabled` + "준비 중" 캡션. `/pay/[id]/page.tsx` `handleSubmit` 재작성 — `idempotencyKey = useMemo(() => crypto.randomUUID(), [])` 1회 생성, `submitPending` 으로 이중 제출 방지, `confirmPayment` 의 `return_url` = `/purchase-done/{transactionId}`, 폴백 `router.push`. 503 분기 제거. 커밋 `cbc85a2`.

### 영향 파일

Tteona-server:
- package.json
- pnpm-lock.yaml
- src/lib/stripe/client.ts (신규)
- src/lib/config.ts
- src/routes/transactions/index.ts
- src/lib/transactions/service.ts
- src/routes/webhooks/stripe.ts (신규)
- src/app.ts

Tteona:
- package.json
- pnpm-lock.yaml
- src/lib/stripe/client.ts (신규)
- src/components/checkout/Pay_B_Legal.tsx
- src/app/(buyer)/pay/[id]/page.tsx

### 그룹 정책 준수 기록

- `db.md` "정규 스키마는 외부(Huya) 소유, 본 그룹은 DDL 미발행" 준수 — 본 플랜은 `transactions` 테이블 신규 컬럼 추가 0건, 마이그레이션 0건. POST dedupe 는 Stripe Idempotency-Key 헤더로 처리(DB unique 제약 대체), payment_failed 사유는 pino 로그로만 기록(`failure_reason` 컬럼 추가 회피).
- Lint 게이트: Tteona-server `pnpm typecheck` PASS / Tteona `pnpm lint` PASS (0 errors).
- advisor #1 + #2 모두 5관점 PASS, BLOCK 없음.

### Spec drift 기록

- 플랜 명세 `status='paid'` → 실 스키마 CHECK 제약(`('pending','success','failed','refunded')`)에 맞춰 코드는 `'success'` 로 구현. 단어 통일 follow-up: Huya 스키마 소유자 통보 또는 플랜 어휘 정정.
- FE `.env.example` 의 `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` 는 이전 작업으로 이미 존재 — 본 플랜이 추가하지 않음(Phase 3 affected_files 에 명시되었으나 실 변경 없음).

### 외부 의존 / 후속

- **Stripe Connected Accounts 미사용 가정**: v1 = 플랫폼 계정 단일 수금 + 내부 회계 split (`platformFeeKrw` / `sellerPayoutKrw` / `stripeFeeKrw` 행 기록). 실제 셀러 송금(`transfer_data.destination` + `application_fee_amount` + 셀러 온보딩) 은 v2 별도 플랜.
- **Webhook RLS bypass 미검증** (Phase 2 blocker): webhook 의 service-role connection 이 `transactions` UPDATE 의 RLS 정책을 통과하는지 정적 검증 불가 — `stripe trigger payment_intent.succeeded` 로 마스터 라이브 검증 필요. 미통과 시 0 rows updated 로 조용한 실패 가능 → 후속 hotfix 후보.
- **고아 pending 행**: 같은 `idempotencyKey` 로 우리 쪽 INSERT 가 중복 발생할 수 있고 webhook 매핑 후 짝 잃은 pending 행이 남을 수 있음. cleanup 잡 v1 미구현(follow-up plan).
- **FE `itineraryId` 출처 미보장** (Phase 3 blocker): `TransactionSummary.itineraryId` 가 optional — undefined 시 BE 가 400 반환. fallback 없음, 마스터 수동 테스트 우선 필요.
- **CardPaymentForm 결제 버튼 금액 표시 0** (Phase 3 blocker): amount prop 미전달로 표시값 0 KRW. 실 결제는 `PaymentElement` 가 `clientSecret` 에서 읽으므로 결제 동작 영향 없음 — UX 후속.
- **Huya 스키마 확장 후보**: `stripe_payment_intent_id` 컬럼(POST dedupe 강화) + `failure_reason` 컬럼(payment_failed 사유 DB 저장) 추가 요청 — 별도 외부 트랙.
- **createRefund RLS 우회 핫픽스** (마스터 명시 권고): 본 플랜 완료 후 PENDING gate 에서 `핫픽스 c.get('tx') 전환` 으로 별도 처리 예정.
- **refunds 플랜 Phase 3 s5 assertion 강화 권고** (마스터 명시): 본 Stripe 플랜의 PENDING gate 핫픽스 범위 밖 — 별도 plan-enterprise 호출 필요.

## v001.8.0 — refunds 테이블 운영 활성화 (Huya DDL/RLS 요청 명세 + Drizzle pgEnum/notNull lockstep + admin-gated 라이브 통합 테스트)

> 통합일: 2026-05-16
> 플랜 이슈: bj-kim-funshare/Tteona#8

### 페이즈 결과

- **Phase 1** (docs, Tteona-server): `docs/db/refunds-schema-request.md` 신규 작성. `refunds.ts` Drizzle 선언을 진실원천 삼아 Huya 스키마 소유자에게 전달할 DDL+RLS 요청 명세 — CREATE TABLE refunds (`transaction_id` NOT NULL + FK ON DELETE RESTRICT, `requested_at` DEFAULT now() NOT NULL), status ENUM 권장안 + CHECK 대안 병기, `idx_refunds_transaction_id`, RLS 3정책(buyer select/insert 허용 + 익명 RESTRICTIVE DENY), FK RESTRICT 검증 절차, 적용 확인 체크리스트, Huya 회신 형식 템플릿 포함. 커밋 `6ff7620`.
- **Phase 2** (refactor, Tteona-server): refunds Drizzle 강화 — `pgEnum('refund_status', ['requested','approved','completed','failed'])` 도입, `transactionId.notNull()`, `requestedAt.defaultNow().notNull()` 추가. relations() 선언(refundsRelations / transactionsRelations)은 circular import 방지를 위해 `schema/index.ts` 에 집중. service/validation/라우트 미변경, typecheck 회귀 없음. 커밋 `0b3c88a`.
- **Phase 3** (test, Tteona-server): `src/__tests__/refunds-integration.test.ts` 신규. `describeIfAdminDb` 블록 6 시나리오 — (s1) admin INSERT buyer-A 트랜잭션 픽스처, (s2) buyer-A POST /refunds → 201, (s3) buyer-A GET → 200, (s4) buyer-B GET → 404 (RLS), (s5) buyer-B POST → [403,404] 허용, (s6) admin DELETE transactions → FK RESTRICT 오류 확인. afterAll cleanup. admin DB 미보유 환경에서는 통째로 skip 되어 CI 안전. 커밋 `3dc1901`.

### 영향 파일

Tteona-server:
- docs/db/refunds-schema-request.md (신규)
- src/lib/db/schema/refunds.ts
- src/lib/db/schema/index.ts
- src/__tests__/refunds-integration.test.ts (신규)

### 그룹 정책 충돌 해소 기록

마스터 invocation 의 `/task-db-structure 와 연계 가능` 문구는 db.md 의 "Huya 외부 소유 / task-db-structure 미발행" 조항과 충돌. 본 plan 은 task-db-structure 디스패치를 의도적으로 제외하고 Huya 요청 명세 artifact 작성으로 우회. advisor #1 / #2 모두 PASS 판정.

### 외부 의존 / 후속

- "운영 활성화 완료" 선언은 (a) Huya 가 Phase 1 명세대로 DDL+RLS 를 admin DB 에 적용 + (b) 통합 테스트 라이브 PASS 두 조건 충족 시점. 본 patch-note 는 in-repo 작업 완료 시점의 기록.
- **service.ts:createRefund 의 RLS 우회 발견** (Phase 3 작성 중): 전역 `db.transaction()` 직접 사용으로 `dbContext()` 의 `app.user_id` 가 INSERT 트랜잭션에 미적용. Huya 가 `refunds_buyer_insert` 정책 적용하는 순간 production INSERT 회귀 위험 → PENDING gate `핫픽스` 또는 별도 plan 후속 권고. (advisor #2 명시 권고.)
- Phase 2 의 Drizzle `.notNull()` 선언과 Huya DDL 적용 사이 윈도우에서 타입-실DB 불일치 잠재 — service 가 신규 INSERT 만 수행하므로 실제 영향 미미.

## v001.7.0 — 단계3-B 바이어 상세/결제/구매완료/환불요청 (BE transactions+refunds 결합 + FE 4 라우트 + 7 컴포넌트 + 4 BFF, warn 토큰 신규)

> 통합일: 2026-05-16
> 플랜 이슈: bj-kim-funshare/Tteona#7

### 페이즈 결과

- **Phase 1** (feat, Tteona-server): `refunds` Drizzle 테이블 신규 선언 (FK→transactions ON DELETE RESTRICT, lifecycle status text + requestedAt/approvedAt/completedAt/failedReason) + transactions/refunds Zod DTO (params/response/body 분리, snake_case 바디). 커밋 `27738a1`.
- **Phase 1.5** (chore, Tteona-server): **SKIPPED** — db.md 명시("drizzle-kit migrate 미사용, 정규 스키마는 외부 Huya owner") + `drizzle/` 디렉터리 부재 확인. 본 페이즈 contingency 발동.
- **Phase 2** (feat, Tteona-server): `GET /transactions/:id` + `GET /transactions/:id/payment-info` 구현. service 레이어 분리(`src/lib/transactions/service.ts`), `c.get('tx') ?? db` RLS 컨벤션, camelCase→snake_case + Date→ISO 매핑. 커밋 `bcb65b4`.
- **Phase 3** (feat, Tteona-server): `POST /refunds` (db.transaction check-then-insert 원자성 + buyer/이미환불/72h 4 에러 경로 discriminated-union) + `GET /refunds/:id` 구현. 커밋 `e81e0e8`. (Informational blockers: transactions.status ↔ refunds.status approve/complete 동기화는 buyer flow 범위 외, admin/automated 후속 페이즈; refunds 테이블 실 DB 미적용 — Phase 1.5 SKIP 영향.)
- **Phase 4** (feat, Tteona): `src/components/trip/Detail_v3A.tsx` + `Blur_B_v3.tsx` + barrel `index.ts`. TrustCard 는 `@/components/trust` 에서 import (복제 없음), `actionSlot?: ReactNode` prop 으로 우상단 ⋯ 메뉴 외부 주입. Blur_B_v3 = 미인증/미결제 게이팅 primitive (중립 토큰). 커밋 `02f93f0`.
- **Phase 5** (feat, Tteona): `Detail_v3B` (가격 영역 accent-soft 강조) + `Detail_v3C` (가격을 헤더 우측 인라인 배치) 변종. A 와 동일 props 시그니처 유지. 커밋 `32c6a50`.
- **Phase 6** (feat, Tteona): `src/components/checkout/Pay_B_Legal.tsx` + barrel. 카드/카카오페이/토스/Apple Pay 4종 선택 UI + DisclosureBanner + VoluntaryCheck + onSubmit 콜백 구조 (BFF 호출 책임은 페이지로 위임). 커밋 `aff707d`.
- **Phase 7** (feat, Tteona): `src/components/refund/Aft_A_Legal.tsx` + barrel. discriminated union `mode: 'purchase-done' | 'refund-done'` 양 모드 완전 구현 — purchase-done 은 secondary-soft + receiptSlot + 긍정 CTA, refund-done 은 **warn/warn-soft 토큰 신규 채택** + 4단계 RefundStatus 라벨 맵 + failedReason 표시 + 72h 정책 재고지. 커밋 `9a85443`.
- **Phase 8** (feat, Tteona): BFF Route Handler 4개 — `POST /api/transactions` (BE Stripe webhook 미구현 → 503 NOT_IMPLEMENTED placeholder), `GET /api/transactions/[id]`, `POST /api/refunds`, `GET /api/refunds/[id]`. Authorization 헤더 BE 전달 + Next.js 16 동적 params Promise 처리. 커밋 `80b6c75`.
- **Phase 9** (feat, Tteona): `/detail/[id]` page/loading/error. 클라이언트 컴포넌트 + apiFetch + useEffect 패턴, `?variant=A|B|C` 기본 A 분기, RefundActionSheet 트리거 actionSlot 주입, 미결제 시 Blur_B_v3 가 판매자 연락처/GPS 영역 가림. 커밋 `c2d5462`.
- **Phase 10** (feat, Tteona): `/pay/[id]` (Pay_B_Legal 합성 + raw fetch 로 503 응답을 '결제 게이트웨이 준비 중' 안내로 변환 — apiFetch 재시도 폭풍 회피) + `/purchase-done/[id]` (Aft_A_Legal mode="purchase-done" 합성, receiptSlot 에 제목/거래번호, '내 여정으로 이동' CTA). 커밋 `2ec3e0c`. (Informational blockers: loading/error 페이지 미작성 — null fallback; raw fetch 결정 의도적 trade-off.)
- **Phase 11** (feat, Tteona): `/refund/request/[id]` 단일 페이지 3단계 상태 머신 (거래 로딩 → 사유 입력 → Aft_A_Legal mode="refund-done"). apiFetch retries:0 으로 중복 환불 요청 방지. **warn 토큰이 사용자에게 최초 노출되는 지점.** 커밋 `dc15b32`. (Informational blockers: loading/error 페이지 미작성 — 인라인 메시지; retries:0 trade-off.)

### 영향 파일

Tteona-server:
- src/lib/db/schema/refunds.ts (신규)
- src/lib/db/schema/index.ts
- src/lib/validation/transactions.ts (신규)
- src/lib/validation/refunds.ts (신규)
- src/lib/transactions/service.ts (신규)
- src/lib/refunds/service.ts (신규)
- src/routes/transactions/index.ts
- src/routes/refunds/index.ts

Tteona:
- src/components/trip/{Detail_v3A,Detail_v3B,Detail_v3C,Blur_B_v3,index}.tsx|ts (신규 5)
- src/components/checkout/{Pay_B_Legal,index}.tsx|ts (신규 2)
- src/components/refund/{Aft_A_Legal,index}.tsx|ts (신규 2)
- src/app/api/transactions/{route,[id]/route}.ts (신규 2)
- src/app/api/refunds/{route,[id]/route}.ts (신규 2)
- src/app/(buyer)/detail/[id]/{page,loading,error}.tsx (신규 3)
- src/app/(buyer)/pay/[id]/page.tsx (신규)
- src/app/(buyer)/purchase-done/[id]/page.tsx (신규)
- src/app/(buyer)/refund/request/[id]/page.tsx (신규)

### 알려진 한계 (후속 결정 필요)

1. **refunds 테이블 실 DB 미적용** (Phase 1.5 SKIP 영향). BE 코드는 컴파일·typecheck 통과하나 환불 흐름 런타임 호출 시 테이블 부재 오류 발생. **외부 Huya 스키마 owner 가 `refunds` 테이블 적용 완료 후에야 환불 흐름 동작.** 마스터 외부 조율 결정 사항.
2. **결제 게이트웨이(Stripe webhook) 미구현** — `POST /api/transactions` 503 placeholder 상태. 결제 flow 는 FE 형태 정합까지만 전달됨 (Pay_B_Legal 폼 → 503 인지 → 안내 메시지). 정상 동작은 후속 S2.5+ Stripe 통합 후. `/purchase-done/[id]` 는 정상 네비게이션으로 도달 불가 (수동 URL 진입은 가능).
3. **buyer pay/purchase-done/refund-request 라우트의 loading/error 페이지 미작성** — 인라인 fallback 사용. UX 개선 별도 작업.
4. **transactions.status ↔ refunds.status approve/complete 동기화 미구현** — buyer flow 범위 외, admin/automated 후속 페이즈.
5. **Detail variant 분배 메커니즘** — query param `?variant=A|B|C` 기본 A 만 구현. 정식 A/B 테스트 분배 (segment/cohort) 는 후속.

## v001.6.0 — 단계3-A 바이어 홈/탐색/피드/검색/필터 (FE 5 화면 + 3 컴포넌트 패키지 + BFF + BE /feed /explore /search)

> 통합일: 2026-05-16
> 플랜 이슈: bj-kim-funshare/Tteona#6

### 페이즈 결과
- **Phase 1** (feat, Tteona-server): GET /feed 핸들러 + feed service.ts (keyset cursor, derivePersonaTags LATERAL jsonb_each 집계) + Zod 검증 + FeedCardDto/FeedResponse 타입. 커밋 `762c039`. (Informational blockers: reviews.categories 실제 shape 미확정 — `{tagName: count}` 객체 가정, 정식 persona 스키마는 후속 plan; itineraries.status='published' 안전 가드 추가.)
- **Phase 2** (feat, Tteona-server): GET /explore (tier-aware 3 단 keyset 정렬) + GET /search (`%`, `_`, `\` 이스케이프 ILIKE title/description 매칭) 라우트 + service.ts FeedOptions 확장 (mode/q 옵션 — 기존 /feed 호출자 무영향) + app.ts 마운트. q 누락/공백 시 400 INVALID_INPUT. 커밋 `9391ea0`.
- **Phase 3** (feat, Tteona): src/components/feed — FeedCard (variant A/B), FeedCardSkeleton + FeedCardDto 미러 타입. variant B 가 PersonaOverlay 합성. 커밋 `c524ac7`. (Informational blockers: FE↔BE type-mirror nullability drift 수용 — BE 타입이 overly pessimistic, FE 미러가 BE service 실제 응답 shape 와 정합; TrustCard 미합성 — detail 페이지용으로 카드 레이아웃 부적합.)
- **Phase 4** (feat, Tteona): src/components/explore — TempMeterCard / CameraLockCard / TimeDecayCard 3 카드 (handoff explore-cards.jsx 포팅). 세 카드 모두 동일 FeedCardDto 소비, 썸네일 오버레이만 시각적으로 분기. 의미적 디스크리미네이터는 후속. 커밋 `a55b17f`.
- **Phase 5** (feat, Tteona): src/components/filter — FilterSheet (바텀시트 컨테이너 children 슬롯) + FilterGroup + FilterChip + FilterState 타입. controlled 패턴 + onApply 콜백. 가격/기간/테마 3 그룹 (지역은 BE region 미지원으로 v1 제외). 커밋 `99dc0b8`.
- **Phase 6** (feat, Tteona): BFF 라우트 3 (App Router `route.ts` — feed/explore/search — 쿼리 화이트리스트 + Authorization pass-through) + React Query v5 `useInfiniteQuery` 훅 3 (`useFeedQuery` URL searchParams 자동 반영, `useExploreQuery`, `useSearchQuery` q 빈문자열 enabled=false) + placeholder README 제거. 커밋 `e44bad0`.
- **Phase 7** (feat, Tteona): (buyer)/layout.tsx AppShell + BottomTabBar 결선 (`'use client'` 선언) + /home (PhotoHero + QuickTile 4 + BigItineraryCard 3 정적 합성) + /feed (useFeedQuery 무한 스크롤 IntersectionObserver, FeedCard variant B, FilterSheet 토글 + router.replace 쿼리스트링 갱신, Suspense 경계). 커밋 `bfa2c09`.
- **Phase 8** (feat, Tteona): /search (debounce 300ms + useSearchQuery + variant A 그리드) + /filter (FilterGroup/FilterChip 직접 합성 + router.push back 이력 보존) + /explore (i%3 라운드 로빈 explore 3 카드 + useExploreQuery 무한 스크롤). BottomTabBar 자기-충족 변환 — TabKey home/feed/search/profile 재정의, `usePathname()` 활성 탭 자동 판정, `useRouter().push` 라우팅. 커밋 `c5fd0d2`.
- **Build-hotfix** (`30025b4`): Phase 7 layout.tsx 가 Phase 8 narrowed TabKey 와 type 충돌하여 `pnpm next build` type-check 단계 실패 — placeholder props 제거하여 `<BottomTabBar />` 단순화. 수정 후 type-check PASS.

### 영향 파일

**Tteona-server (BE)**:
- `src/routes/feed/index.ts` · `src/routes/explore/index.ts` (신규) · `src/routes/search/index.ts` (신규)
- `src/lib/feed/service.ts` (신규) · `src/lib/validation/feed.ts` (신규) · `src/types/feed.ts` (신규)
- `src/app.ts`

**Tteona (FE)**:
- `src/app/(buyer)/layout.tsx`
- `src/app/(buyer)/home/page.tsx` · `home/_components/{PhotoHero,QuickTile,BigItineraryCard}.tsx` (모두 신규)
- `src/app/(buyer)/feed/page.tsx` · `search/page.tsx` · `filter/page.tsx` · `explore/page.tsx` (모두 신규)
- `src/app/api/feed/route.ts` · `api/explore/route.ts` (신규) · `api/search/route.ts` (신규) · `api/feed/README.md` (제거)
- `src/components/feed/{FeedCard,FeedCardSkeleton,index}.{tsx,ts}` (신규)
- `src/components/explore/{TempMeterCard,CameraLockCard,TimeDecayCard,index}.{tsx,ts}` (신규)
- `src/components/filter/{FilterSheet,FilterGroup,FilterChip,index}.{tsx,ts}` (신규)
- `src/components/common/BottomTabBar.tsx`
- `src/hooks/feed/{useFeedQuery,useExploreQuery,useSearchQuery,index}.{ts}` (신규)
- `src/types/feed.ts` (신규) · `src/types/filter.ts` (신규)

### v1 carve-outs (의도적, 후속 plan 으로 이연)
- region 필터: `region` 컬럼이 trips 에만 존재하고 `itineraries.tripId` nullable → BE/FE 모두 미지원
- persona 의미 매핑: reviews.categories jsonb 상위 2 키 임시 mirror, 정식 persona 필드 도입은 단계 3-D 또는 별도
- explore 카드 의미적 디스크리미네이터 (temperatureBucket / lockState / freshnessTier): BE 스키마 확장 시점에 추가
- FeedCard → /detail/[id] 라우팅: detail 라우트는 단계 3-B 에서 생성, 본 plan 은 `<Link href>` 만 두고 placeholder
- BottomTabBar profile 탭 (`/buyer`): 단계 3-D 마이/알림 페이지로 재매핑 예정

### 사전 발견 (본 plan 범위 외)
- `(auth)/login/page.tsx` (plan #5 phase 8, `e5580fc`) 에 `useSearchParams()` Suspense 경계 누락으로 `pnpm next build` page-data 단계 prerender 실패. 본 plan 신규 페이지 (`/feed` `/search` 등) 는 모두 Suspense 적절 래핑. 별도 핫픽스 이슈 권장.

## v001.5.0 — 단계2 인증 통합 (FE (auth) 라우트 + BE /auth/* 풀스택)

> 통합일: 2026-05-15
> 플랜 이슈: bj-kim-funshare/Tteona#5

### 페이즈 결과
- **Phase 1** (feat, Tteona-server): users 스키마에 `passwordHash` (text, nullable) 컬럼 추가 + `password_reset_tokens` 테이블 신설 (id/userId/tokenHash/expiresAt/usedAt/createdAt). schema/index.ts 에 재익스포트 추가. 마이그레이션 SQL 미생성 — drizzle.config.ts 원본 주석 (외부 도구가 캐노니컬 스키마 소유) 보존. 커밋 `125b406d` (iter 2/3 — 1차 시도가 drizzle-kit generate 로 1080라인 마이그레이션 + config 수정한 것을 회수 후 재실행).
- **Phase 2** (feat, Tteona-server): bcrypt 6.0.0 의존성 + 4개 유틸리티 신설. `src/lib/auth/password.ts` (cost 12 hash/verify), `src/lib/auth/jwt.ts` (jose 기반 HS256 sign/verify, 7d exp), `src/lib/validation/auth.ts` (zod 5종 — signup/login/forgotPassword/resetPassword/socialComplete), `src/lib/http/error.ts` (ApiError 타입 + jsonError helper + 표준 에러 코드 6). 커밋 `fde5f11f`.
- **Phase 3** (feat, Tteona-server): `POST /auth/signup` 핸들러 — drizzle transaction 으로 users + user_consents 동시 INSERT, consent version=`{terms:"S2.1",privacy:"S1.5"}` JSON 직렬화, HS256 JWT 발급. 커밋 `3d2728b9` + lint-hotfix `a67933a` (drizzle `.returning()` undefined 가드).
- **Phase 4** (feat, Tteona-server): `/auth/login` (verifyPassword + JWT 발급, enumeration 방지 401 통일), `/auth/session` (authMiddleware + c.get('userId')), `/auth/logout` (v1 stateless 200, blacklist v2 보류). 커밋 `11166fd5`.
- **Phase 5** (feat, Tteona-server): kakao/google/apple OAuth 3-handler (initiate + callback + complete). fetch 기반, jose 만 사용 (Apple ES256 client_secret 동적 서명). state HMAC-SHA256 + base64url + 만료 10분. callback 응답 `{user, token, consent_required}` JSON 통일. complete 는 신규 사용자 consent 수집 (Phase 3 와 동일 형식). env 12종 (KAKAO_*, GOOGLE_*, APPLE_*, OAUTH_STATE_SECRET) optional 추가, config.ts zod 확장. 커밋 `3c0b326`. (Informational blockers: Apple form_post BE→FE redirect 재구성은 v2 보류.)
- **Phase 6** (feat, Tteona-server): `/auth/forgot-password` (32바이트 랜덤 토큰 + SHA-256 hash 만 DB 저장, enumeration 방지 200 통일, stub console.info), `/auth/reset-password` (tokenHash + usedAt isNull + expiresAt 검증, drizzle transaction 으로 passwordHash 갱신 + usedAt 마킹). 커밋 `0efad342`.
- **Phase 7** (feat, Tteona): Next.js 16 App Router Route Handler 9개 (`/api/auth/{signup,login,logout,session,forgot-password,reset-password,social/[provider],social/callback,social/complete}`) + 헬퍼 3 (`api.ts` beFetch, `session.ts` get/set/clear, social.ts stub 교체) + minimal middleware. JWT 는 `tteona_session` httpOnly Secure SameSite=Lax 쿠키 (maxAge 7d) 관리. social initiate 는 redirect:'manual' 로 BE 302 캐치 후 NextResponse.redirect. 커밋 `72a4828`.
- **Phase 8** (feat, Tteona): `(auth)/login` (LegalProvider scope="login" + EmailPasswordForm + SocialLoginV2 dialog), `(auth)/signup` (2-step EmailPasswordForm → SignupConsentForm), EmailPasswordForm / SignupConsentForm 2 컴포넌트 신설. stub `(auth)/auth/page.tsx` 삭제, layout.tsx 최소 wrapper. 커밋 `e5580fc`.
- **Phase 9** (feat, Tteona): `(auth)/social-callback/[provider]` (Next 15 `use(params)` + useEffect 마운트 fetch + consent_required 분기), SocialCompleteConsent 컴포넌트 (LegalProvider wrapper + `/api/auth/social/complete` POST), `(auth)/forgot-password` (enumeration 방지 동일 메시지), `(auth)/reset-password` (토큰 query 검증, 성공시 /login). 커밋 `062ad9f5`.

### 영향 파일

**Tteona-server (BE)**:
- `src/lib/db/schema/users.ts` (passwordHash 1 컬럼 추가)
- `src/lib/db/schema/password-reset-tokens.ts` (신규)
- `src/lib/db/schema/index.ts` (재익스포트 추가)
- `src/lib/auth/password.ts` (신규)
- `src/lib/auth/jwt.ts` (신규)
- `src/lib/auth/oauth/kakao.ts` (신규)
- `src/lib/auth/oauth/google.ts` (신규)
- `src/lib/auth/oauth/apple.ts` (신규)
- `src/lib/validation/auth.ts` (신규)
- `src/lib/http/error.ts` (신규)
- `src/lib/config.ts` (env 확장)
- `src/routes/auth/index.ts` (8 라우트 등록 추가)
- `src/routes/auth/signup.ts` (신규)
- `src/routes/auth/login.ts` (신규)
- `src/routes/auth/session.ts` (신규)
- `src/routes/auth/logout.ts` (신규)
- `src/routes/auth/social.ts` (신규)
- `src/routes/auth/password-reset.ts` (신규)
- `.env.example` (12 env 추가)
- `package.json`, `pnpm-lock.yaml` (bcrypt 추가)

**Tteona (FE)**:
- `src/app/(auth)/auth/page.tsx` (삭제 — stub)
- `src/app/(auth)/layout.tsx` (max-w-md wrapper)
- `src/app/(auth)/login/page.tsx` (신규)
- `src/app/(auth)/signup/page.tsx` (신규)
- `src/app/(auth)/social-callback/[provider]/page.tsx` (신규)
- `src/app/(auth)/forgot-password/page.tsx` (신규)
- `src/app/(auth)/reset-password/page.tsx` (신규)
- `src/app/api/auth/signup/route.ts` (신규)
- `src/app/api/auth/login/route.ts` (신규)
- `src/app/api/auth/logout/route.ts` (신규)
- `src/app/api/auth/session/route.ts` (신규)
- `src/app/api/auth/forgot-password/route.ts` (신규)
- `src/app/api/auth/reset-password/route.ts` (신규)
- `src/app/api/auth/social/[provider]/route.ts` (신규)
- `src/app/api/auth/social/callback/route.ts` (신규)
- `src/app/api/auth/social/complete/route.ts` (신규)
- `src/lib/auth/api.ts` (신규)
- `src/lib/auth/session.ts` (신규)
- `src/lib/auth/social.ts` (stub → 실 구현)
- `src/middleware.ts` (신규 minimal)
- `src/components/auth/EmailPasswordForm.tsx` (신규)
- `src/components/auth/SignupConsentForm.tsx` (신규)
- `src/components/auth/SocialCompleteConsent.tsx` (신규)

### 비고 / v2 보류 항목
- **consent 버전 표기**: `S2.1` (terms) / `S1.5` (privacy) — 약관/개인정보 문서 버전 식별자로 해석 (마스터 자율 진행 모드, 플랜에 명시). 다른 의미였다면 향후 plan 으로 재구성.
- **메일 발송 인프라**: forgot-password 는 v1 stub console.info — SMTP/SendGrid 통합 별도 plan.
- **OAuth provider 자격증명**: env 항목만 추가 — kakao/google/apple 의 실 client ID/secret 은 배포 시 마스터가 .env 에 채움.
- **Apple form_post → BE→FE redirect 재구성**: v2 (현 v1 은 모든 provider callback 을 JSON 응답으로 통일, FE BFF fetch 가정).
- **JWT blacklist (강제 로그아웃)**: v2 — 현 logout 은 클라이언트 토큰 폐기 + 쿠키 삭제만.
- **FE 브라우저 smoke-test**: 본 플랜은 lint-only 검증 — 실제 OAuth flow / 폼 제출 / 쿠키 동작은 마스터 수동 점검 필요.

## v001.4.0 — 단계1 v3 공유 디자인 프리미티브 라이브러리

> 통합일: 2026-05-15
> 플랜 이슈: bj-kim-funshare/Tteona#4

### 페이즈 결과
- **Phase 1** (feat, Tteona): v3 핸드오프 두 파일 (`떠나(Tteona)/components/v3-trust.jsx` 203L, `v3-detail-patches.jsx` 289L) 의 공유 프리미티브 10종을 React 19 + TypeScript strict 컴포넌트로 포팅. `src/components/trust/` 신설 (TierBadge 3-tier, TapTarget 44 wrapper, TrustCard variant A/B, PersonaChipRow, PersonaOverlay, ReportFlagBtn 이전본 + index 배럴) + `src/components/itinerary/` 채움 (DaySummaryRow, StructuredDay, BlurredPreview, TimelineAutoDraft + index 배럴). 핸드오프의 `window.*` 글로벌 주입 / `_v3I.*` 아이콘 문자열 lookup 패턴은 모두 lucide-react named import 로 대체. 기존 `src/components/legal/ReportFlagBtn` 을 `trust/` 산하로 이전 (파일 + 테스트 git rename), `legal/slots/ReportFlagBtnSlot.tsx` import 경로를 `@/components/trust/ReportFlagBtn` 절대 경로로 갱신. `SCOPE_SLOT_MATRIX` 레지스트리 키와 legal-showcase 테스트 헤더 매칭 문자열은 의도적으로 보존. 커밋 `c208f19` + 후속 fix `1989d6e` (TrustCard.signals / TimelineAutoDraft.days 의 인라인 mock 기본값 제거 — 프리미티브는 caller 가 데이터를 주입하는 순수 컴포넌트로 유지).

### 영향 파일

**Tteona (FE)**:
- `src/components/trust/TierBadge.tsx` (신규)
- `src/components/trust/TapTarget.tsx` (신규)
- `src/components/trust/TrustCard.tsx` (신규, TrustSignal 내부 helper 포함)
- `src/components/trust/PersonaChipRow.tsx` (신규)
- `src/components/trust/PersonaOverlay.tsx` (신규)
- `src/components/trust/ReportFlagBtn.tsx` (이전 — legal/ 에서 git rename)
- `src/components/trust/index.ts` (배럴, 신규)
- `src/components/trust/__tests__/ReportFlagBtn.test.tsx` (이전)
- `src/components/itinerary/DaySummaryRow.tsx` (신규)
- `src/components/itinerary/StructuredDay.tsx` (신규)
- `src/components/itinerary/BlurredPreview.tsx` (신규)
- `src/components/itinerary/TimelineAutoDraft.tsx` (신규)
- `src/components/itinerary/index.ts` (배럴, 신규)
- `src/components/legal/slots/ReportFlagBtnSlot.tsx` (갱신: import 경로)
- `src/components/legal/ReportFlagBtn.tsx` (삭제 — trust/ 로 이전)
- `src/components/legal/__tests__/ReportFlagBtn.test.tsx` (삭제 — trust/__tests__/ 로 이전)
- `src/components/itinerary/.gitkeep` (삭제)

### 검증
- Phase 1 lint 게이트 (`pnpm lint`) 통과 (초기 통과 후 fix 커밋 1989d6e 재실행 시에도 통과).
- 5-perspective advisor (Intent / Logic / Group Policy / Evidence / Command Fulfillment) 계획·완료 시점 양측 PASS — advisor #1 (계획) 무차단, advisor #2 (완료) 무차단 (mock data 위반은 advisor #2 직전 검토에서 발견되어 fix 커밋으로 선제 해소).
- 후속 단계 인지용 (informational, 차단 아님): TrustCard 의 `TrustSignalItem.icon` 은 `LucideIcon` 타입 — 호출처가 signals prop 을 구성할 때 lucide-react named import 사용. TimelineAutoDraft → TierBadge/TapTarget cross-import 는 의도된 단방향 의존 (단일 phase 묶음 사유 = 토큰·아이콘 공유, 마스터 명시).

## v001.3.0 — Issue #2 결함 fix (block 1 + warn 1)

> 통합일: 2026-05-15
> 플랜 이슈: bj-kim-funshare/Tteona#3 (원 dev-inspection 이슈: bj-kim-funshare/Tteona#2)

### 페이즈 결과
- **Phase 1** (fix, Tteona): 5개 라우트 그룹 page (`(auth)/(buyer)/(seller)/(social)/(system)/page.tsx`) 가 모두 루트 `/` 로 resolve 되어 발생하던 Next.js parallel-page 충돌을, 각 그룹의 동명 세그먼트 (`(group)/{group}/page.tsx`) 로 git rename 이동하여 해소. URL 은 `/auth /buyer /seller /social /system` 로 분리, 루트 `/` 는 단계 0 미할당. 커밋 `40b1ce6` + lint-hotfix `d195e1d` (`(dev)/legal-showcase/__tests__/page.test.tsx` 사전 존재 미사용 `screen` import 제거 — strict next lint 통과 목적).
- **Phase 2** (fix, Tteona): `src/lib/api/client.ts:53` 의 `RETRY_DELAYS_MS[attempt - 1]` lookup 에 nullish-coalescing 추가 (`?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]`) — 호출자가 `retries ≥ 3` 으로 지정해도 마지막 정의된 지연 (750ms) 으로 클램프되어 `setTimeout(..., undefined)` 백오프 폭주 방지. 커밋 `2fc0994`.

### 영향 파일

**Tteona (FE)**:
- `src/app/(auth)/page.tsx` → `src/app/(auth)/auth/page.tsx` (rename)
- `src/app/(buyer)/page.tsx` → `src/app/(buyer)/buyer/page.tsx` (rename)
- `src/app/(seller)/page.tsx` → `src/app/(seller)/seller/page.tsx` (rename)
- `src/app/(social)/page.tsx` → `src/app/(social)/social/page.tsx` (rename)
- `src/app/(system)/page.tsx` → `src/app/(system)/system/page.tsx` (rename)
- `src/app/(dev)/legal-showcase/__tests__/page.test.tsx` (lint-hotfix)
- `src/lib/api/client.ts`

### 검증
- Phase 1·2 lint 게이트 (`pnpm lint`) 통과.
- Phase 1 추가 검증: `pnpm build` (Next.js 16.2.4) 성공 — 8 개 라우트 (`/auth /buyer /legal-showcase /seller /social /system /_not-found /`) 정적 생성, parallel-page 오류 무발생.
- advisor 5-관점 (Intent/Logic/Group Policy/Evidence/Command Fulfillment) 계획·완료 시점 양측 PASS.

## v001.2.0 — 단계0 인프라 동기 코드드롭

> 통합일: 2026-05-15
> 플랜 이슈: bj-kim-funshare/Tteona#1
> 매니페스트 호스팅 노트: skill spec 의 "leader repo 의 patch-note" 경로는 Project-I2 매니페스트 호스팅 사실과 충돌하여 본 엔트리는 I-OS (Project-I2) `main` 브랜치 위에 작성됨. 차회 plan-enterprise tteona 부터 동일 패턴.

### 페이즈 결과
- **Phase 1** (chore, Tteona): `sketch.css` 를 레퍼런스 전용으로 표식 — 토큰 4종 (`--secondary-soft / --accent-soft / --warn-soft / --overlay-dim`) 이 이미 `src/app/globals.css` 에 이관 완료 (각 ≥ 4 회) 확인 후 canonical 경로 `tteona-claude-code-handoff/03-design/wireframes/styles/sketch.css` 상단에 "디자인 레퍼런스 전용 — 런타임 미사용" 주석 6행 추가. 커밋 `e31c045`.
- **Phase 2** (feat, Tteona): `src/app/` 에 라우트 그룹 5종 ((auth)/(buyer)/(seller)/(system)/(social)) 골격 추가 — 각 그룹별 `layout.tsx` (pass-through, `{ children: React.ReactNode }` 명시) + S2 TODO placeholder `page.tsx`. 커밋 `741044a`.
- **Phase 3** (feat, Tteona): `src/components/common/` 에 `AppShell` / `TopBar` / `BottomTabBar` 골격 컴포넌트 추가 — plain HTML + Tailwind v4 토큰만 (shadcn primitives 미사용), `BottomTabBar` 는 정확히 4 탭 (buyer/seller/social/system, auth 미포함), `role="tablist"` 등 ARIA 적용, `index.ts` 배럴. 커밋 `a95a584`.
- **Phase 4** (feat, Tteona): API client 인프라 — `zod` 4.4.3 추가, `src/lib/env.ts` (NEXT_PUBLIC_* zod URL 검증 + freeze), `src/lib/api/{client,errors,index}.ts` (apiFetch: 매 시도 새 AbortController + 8s timeout, 5xx/네트워크 최대 2회 지수 백오프 250/750ms, 4xx 즉시 throw, `credentials: 'include'` 기본, `sessionToken → Authorization: Bearer`, `ApiError/ApiTimeoutError/ApiNetworkError` 클래스). 커밋 `3c0d6f6` + 후속 `.env.example` 보완 `17e08cd`.
- **Phase 5** (feat, Tteona-server): `hono/cors` 미들웨어를 `src/app.ts` 의 honoLogger 다음, requestLogger 이전 위치에 삽입 — origin 콜백이 `config.corsOrigins` 화이트리스트 검사, `credentials: true`, `allowHeaders: [Authorization, Content-Type]`, `allowMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]`, `maxAge: 600`. `src/lib/config.ts` zod schema 에 `CORS_ORIGINS` 추가 (default `http://localhost:3000`), `corsOrigins: string[]` split-trim 노출. `.env.example` 에 `CORS_ORIGINS` 라인 추가. 커밋 `7b5a5d4`.

### 영향 파일

**Tteona (FE)**:
- `tteona-claude-code-handoff/03-design/wireframes/styles/sketch.css`
- `src/app/(auth)/layout.tsx`, `src/app/(auth)/page.tsx`
- `src/app/(buyer)/layout.tsx`, `src/app/(buyer)/page.tsx`
- `src/app/(seller)/layout.tsx`, `src/app/(seller)/page.tsx`
- `src/app/(system)/layout.tsx`, `src/app/(system)/page.tsx`
- `src/app/(social)/layout.tsx`, `src/app/(social)/page.tsx`
- `src/components/common/AppShell.tsx`, `src/components/common/TopBar.tsx`, `src/components/common/BottomTabBar.tsx`, `src/components/common/index.ts`
- `src/lib/env.ts`, `src/lib/api/client.ts`, `src/lib/api/errors.ts`, `src/lib/api/index.ts`
- `package.json`, `pnpm-lock.yaml`, `.env.example`

**Tteona-server (BE)**:
- `src/app.ts`, `src/lib/config.ts`, `.env.example`

### 검증

- 모든 5 페이즈 lint/typecheck 게이트 통과 (`pnpm lint` FE, `pnpm typecheck` BE 모두 exit 0).
- advisor 5-관점 (Intent/Logic/Group Policy/Evidence/Command Fulfillment) 계획·완료 시점 양측 PASS.

## v001.1.0 — Commit&Push 대기중
