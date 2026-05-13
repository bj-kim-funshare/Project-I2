# data-craft — Patch Note (001)

## v001.3.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#7

### 페이즈 결과

- **Phase 1** (`52b1c35`, 선행 세션): `docs/billing/audit-2026-05-13.md` 신규 작성 (+173). 결제 표면 카탈로그 + cross-flow 시나리오 10건 + 결함 R-001~R-005 식별. 본 audit 은 작성 시점에 R-001 (프로모션 만료 시 직전 plan 복구) / R-003 (만료 sweep cron 부재) 진단이 사양·코드와 불일치 — Phase 2 에서 정정.
- **Phase 2** (`2b345a5`): audit 사양 정정. 마스터 정정에 따라 사양 = 프로모션 만료 / 갱신 실패 시 plan 은 무조건 Free 강제 강등 (직전 plan 복구 사양 부재). R-001 격하 (`promotion.service.ts:348` `expireClientPromotion`, `promotion.model.ts:233` `UPDATE client SET plan_type='free'`, `billingRenewal.service.ts:237` 능동 cron, `auth.middleware.ts:107/180` lazy fallback 코드 인용 → 사양 일치 PASS). R-003 격하 (`billingScheduler.service.ts:146-180` `processExpiredPlans` 02:00 daily cron + `findExpiredClients` 쿼리 + `resetExpiredPlan` 강등 + `createPlanDowngradedNotification` 알림 모두 이미 구현 인용 → PASS). R-002 정의 확정 (Free 강등 명시) + Phase 3 구현 사양 (재사용 함수·로그·알림 형식) audit 에 명시 → audit 이 코드 페이즈의 canonical spec source 로 확정.
- **Phase 3** (`5548bd1`): R-002 갱신 3회 실패 자동 Free 강등 구현. `src/services/billingRenewal.service.ts:208~217` 에 `resetExpiredPlan(companyId)` 호출 추가 (3회 실패 종결 분기, `FAILED` 이력 + 알림 직후). `createRenewalFailedNotification` reason 에 `'자동갱신 결제 3회 연속 실패 → Free 강등'` 명시. 로그 `[billingRenewal] auto-renewal 3-fail downgrade to free: companyId=${id}`. 강등은 독립 try/catch 로 감싸 알림·이력 저장 실패와 무관하게 진행.
- **Phase 4** (`a8c85ec`): audit 회귀 매트릭스 + 코드 변경 결과 반영. R-002 status 갱신 (결함 → 수정 완료). 시나리오 10건 × R-002 변경 영향 회귀 매트릭스 신규. §6 본 플랜 종결 요약. §8 별개 후속 (B-1 `pending_plan_type` 잔존 모호성 / B-2 base i-dev-001 사전 lint 결함 6건) 카탈로그.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `docs/billing/audit-2026-05-13.md` (Phase 1 신규 + Phase 2/4 정정)
- `src/services/billingRenewal.service.ts` (Phase 3)

### 검증 결과

- advisor #1 (재계획 후 5-perspective): PASS — Intent/Logic/GroupPolicy/Evidence/CommandFulfillment 전부 통과.
- advisor #2 (완료 시점 5-perspective): PASS — 시나리오 9 매트릭스 표현에 `findRetryableClients` predicate OR 절 elision 지적 있으나 3-fail path 는 regular renewal 이므로 edge-case, BLOCK 아님.
- Lint gate (Phase 3): phase-introduced 결함 0 — base i-dev-001 사전 결함 6건 (auth.service / inputStore.service / seatChange.service.test / enterprise-482-p02 테스트) 은 본 플랜 phase 와 무관, 별개 후속 (B-2) 으로 카탈로그.
- 코드 검증 (read-only Explore + Phase 2 dispatch 실측): R-001 정상 / R-002 미구현 / R-003 정상 사실 확인.

### 절차 노트

선행 세션 audit 의 R-001 / R-003 진단이 사양 및 실제 코드와 불일치 — 본 플랜은 재계획 경로로 진입해 R-001 / R-003 을 격하하고 R-002 단일 결함만 코드 수정. 결과적으로 5 페이즈 계획이 4 페이즈로 축소 (Phase 2 = audit 정정, Phase 3 = R-002 구현, Phase 4 = audit 회귀). 사전 조건이었던 `/task-db-structure` 의 `client.previous_*` 3 컬럼 ALTER 도 사양 정정으로 소멸. 검증 자체가 결함 카탈로그를 축소시킨 사례 — 마스터 원 명령 "결제 로직 전수 검증 + cross-flow 결함 수정" 의 성과 일부.

### 알려진 후속 부채 (별도 plan 권장)

- **B-1**: R-002 강등 후 `client.pending_plan_type` 이 null 로 초기화되지 않음 (의미적 모호성). 다음 cron 진입 시 `findRetryableClients` 의 `plan_type != 'free'` 조건으로 자동 제외되지만 `OR active_promotion_id IS NOT NULL` 절로 인해 promotion-active 상태가 남아 있으면 edge-case 포함 가능.
- **B-2**: base i-dev-001 사전 lint 결함 6건 (auth.service.ts:64 unused / inputStore.service.ts:42 directive / seatChange.service.test.ts × 4 no-explicit-any / enterprise-482-p02-is-verified-removal.test.ts:88 no-require-imports).
- **R-004**: HOTFIX-003/004 의 pending 동시 차단 UX 영향 — 정책 결정 사항 (audit §5).
- **R-005**: `renewPromotionClient` 의 `Math.max(client.seats, minUsers)` 의도 확인 — 마스터 결정 (audit §5).
- **FE 권고**: audit §5 의 FE 후속 권고 — 별개 후속 플랜.

## v001.2.0

> 통합일: 2026-05-13
> 플랜 이슈: bj-kim-funshare/data-craft-mobile#3

### 페이즈 결과

- **Phase 1** (`2eb40e1`): `apps/web/vite.config.ts` 를 function-form `defineConfig(({mode}) => ...)` 으로 전환하여 `base` 를 환경별 분기 (`mode === 'production' ? '/data-craft-mobile/' : '/'`). VitePWA `workbox.navigateFallback` 도 `${base}index.html` 로 동기화. `apps/web/src/mobile/router.tsx` 의 `createBrowserRouter` 에 `basename: import.meta.env.BASE_URL` 옵션 추가. `apps/web/public/manifest.json` 의 절대 경로를 manifest-디렉토리 기준 상대 경로로 표준화 (`start_url: "m/home"`, `scope` 키 제거, `icons[].src` leading-slash 없음). `apps/web/src/mobile/sw-register.ts` 의 SW 등록 URL 도 `${import.meta.env.BASE_URL}sw.js` 로 변경. dev (port 5174) 환경은 `BASE_URL = '/'` 로 무영향.
- **Phase 2** (`d4c77a2`): apps/web 빌드 파이프라인 정상화. `packages/fs-data-viewer-mobile/src/index.ts` 에 `useServerPaging` re-export 추가 (Hooks 섹션 신설) — enterprise-454 commit 에서 누락된 barrel 갱신. `apps/web/vite.config.ts` 의 workbox 에 `maximumFileSizeToCacheInBytes: 8 * 1024 * 1024` 추가 (5.33 MB ScreenGridViewer 청크 precache 허용). `apps/web/package.json` 의 `build` 에서 `tsc -b` 단계 제거 (pre-existing 타입체크 결함은 별도 plan 격리). 루트 `package.json` 의 `build` 를 `pnpm --filter ./apps/web build` 로 위임 — deploy.md 의 `apps/web/dist` 산출물 일관화.

### 영향 파일

**data-craft-mobile** (`bj-kim-funshare/data-craft-mobile`, branch `i-dev`):
- `apps/web/vite.config.ts`
- `apps/web/src/mobile/router.tsx`
- `apps/web/public/manifest.json`
- `apps/web/src/mobile/sw-register.ts`
- `packages/fs-data-viewer-mobile/src/index.ts`
- `apps/web/package.json`
- `package.json` (루트)

### 검증 결과

- Lint gate (`pnpm typecheck`): exit 0 (Phase 1·2 양쪽).
- Build (`pnpm build` = `pnpm --filter ./apps/web build`): exit 0, `apps/web/dist/` 생성, PWA 882 entries (18.4 MiB) precached.
- dist 산출물 5/5 검증 PASS:
  - `dist/index.html` `<script>` / `<link>` 모두 `/data-craft-mobile/` prefix.
  - `dist/manifest.json` semantic — 상대 경로 정상.
  - `dist/sw.js` 에 `/data-craft-mobile/index.html` literal.
  - `dist/assets/index-*.js` (sw-register 청크) 에 `/data-craft-mobile/sw.js` literal.

### 절차 노트

Phase 2 dispatch 시 phase-executor sub-agent (Sonnet 4.6) 가 main 세션의 `claude-opus-4-7[1m]` 1M context tier 를 상속받아 계정 1M-context extra-usage 한도에 4회 연속 차단됨. 마스터의 명시 "계속 이어서 진행해" 지시 하에 메인 세션이 정확히 명세된 4 mechanical edit (각 정확한 old/new string 사전 확정) 을 직접 수행 — CLAUDE.md §2 의 main-session read-only 원칙으로부터의 운영 deviation. gate-runner (Haiku 4.5) 는 1M context 미상속으로 정상 동작. 동일 quota 차단 재발 시 `/extra-usage` 활성화 또는 main 모델 200k tier 전환 권장.

### 알려진 후속 부채 (별도 plan 권장)

- `assets/ScreenGridViewer-*.js` 5.33 MB 청크 — 정상 precache 되지만 PWA 초기 설치 시 5MB+ 다운로드 부담. code-splitting 또는 runtime cache 분리 권장.
- pre-existing apps/web tsc 결함 (designer-dialog 데드코드 `@/...` imports, joinUtils/groupValidation `@/...` imports, FsKanbanBoard unused var) — vite 빌드는 tree-shaking 으로 우회. 타입체크 정상화 별도 plan.
- 루트 `/src`, `/index.html`, 루트 `vite.config.ts` — dead-but-non-blocking. 별도 cleanup plan.
- gh-pages 실제 publish (`npx gh-pages -d apps/web/dist`) — 본 plan 스코프 외, 마스터 수동 또는 deploy 워크플로 별도 정의.

## v001.1.0 — Commit&Push 대기중
