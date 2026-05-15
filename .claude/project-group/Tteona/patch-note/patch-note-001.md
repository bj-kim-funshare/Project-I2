# Tteona — Patch Note (001)

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
