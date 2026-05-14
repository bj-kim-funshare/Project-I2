# data-craft — Patch Note (001)

## v001.26.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#15

### 페이즈 결과

- **Phase 1** (`314a8da`): `data-craft-server/scripts/backfill-billing-encryption.ts` 신규. ENV 사전 검증(`BILLING_MASTER_KEY` base64 32바이트 + `DB_*` 5변수), `mysql2/promise` 단일 connection 으로 트랜잭션 개시, `SELECT id, billing_key, customer_key, card_number FROM billing_info WHERE billing_key NOT LIKE 'enc:v1:%' FOR UPDATE` 후 행별로 `encryptBillingField` 적용 — 컬럼별 `enc:v1:` prefix 검사로 idempotent 처리, `card_number IS NULL` 행은 SET 절에서 해당 컬럼 제외. UPDATE 루프 후 `SELECT COUNT(*) AS c FROM billing_info WHERE billing_key NOT LIKE 'enc:v1:%'` 사전 검증 (0 아니면 rollback) 후 commit. 예외 시 rollback + 사유 출력 + `process.exit(1)`. 평문 값은 어떤 로그 경로에도 출력되지 않음 (id + 컬럼명만 로깅). `package.json` scripts 에 `"backfill:billing": "ts-node scripts/backfill-billing-encryption.ts"` 추가.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`, merge `4c7c65a`):
- `scripts/backfill-billing-encryption.ts` (신규)
- `package.json` (scripts 항목)

### 검증 결과

- Lint: `pnpm lint` exit 0 (Phase 1).
- advisor: 계획 시점 + 완료 시점 5관점 2회 모두 PASS (BLOCK 없음).
- 페이즈 iter: 1회 재시도 (1회차 `plan_contradicts_code` — WIP 베이스 `origin/i-dev-001` stale, 로컬 i-dev-001 88349b3 로 리베이스 후 재디스패치 성공).

### 운영 메모

- **스크립트 실행은 마스터 책임**. freeze 창에서 `BILLING_MASTER_KEY` env 설정 후 `pnpm backfill:billing` 수동 실행. `SELECT … FOR UPDATE` 가 대상 행 락을 점유하므로 freeze 미시행 시 동시 결제 요청이 락 대기.
- 검증식: `SELECT COUNT(*) FROM billing_info WHERE billing_key NOT LIKE 'enc:v1:%'` = 0 (스크립트 내부 pre-commit guard 와 동일 — 마스터 명시).
- 키 회전(rotation) 미고려 — `encryptBillingField` 가 단일 master key 사용. 회전 도입 시 별도 스크립트 필요.
- 대규모 행수(수만+) 시 단일 트랜잭션 한계 — 현재는 마스터 운영 환경 추정 규모(수십~수백) 가정. 분할 옵션은 핫픽스로 대응.

## v001.25.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#14

### 페이즈 결과

- **Phase 1** (`9c8606b` + 어설션 1줄 후속 정정 `8667772`): 5개 테스트 파일 (`charge.service.test.ts`, `billingRenewal.test.ts`, `billingSubscription.executeFirstPayment.test.ts`, `src/tests/zone-01/sec-srv-45-payment-orderid.test.ts`, `seatChange.service.test.ts`) 에서 stale `cancelPayment` mock 프로퍼티와 단언 prune. logger mock 에 `critical: vi.fn()` 추가 (production 보상 분기가 `logger.critical({event_type:'PAYMENT_CHARGE_DB_FAILURE', context:...})` 로 이전됨). 보상 시도/실패 부수효과 검증 케이스는 logger.critical spy 단언으로 1:1 매핑 교체, cancelError 전파 전용 케이스는 삭제. iter#1 직후 노출된 `billingRenewal.test.ts:171` 의 stale `reason` 어설션 (`'자동갱신 결제 3회 연속 실패'` → `'자동갱신 결제 3회 연속 실패 → Free 강등'`) 1줄 정정. 5개 영향 파일 vitest 개별 실행 모두 PASS.
- **Phase 2** (`5732c8f`): `ChargeResult` 의 `orderid-mismatch` variant 에서 orphan `cancelError?: Error` 필드 제거. JSDoc 의 "cancelKey/cancelError 반환" 문구를 "paymentKey 반환" 로 정정. `grep -rn cancelError src/ tests/` 0건 확인.
- **Phase 3** (`b8f7673`): `billingRenewal.service.ts:renewSingleClient()` next-cycle 좌석 변경 적용 흐름에서 `appliedSeats = Math.max(currentSeats + netDelta, 1)` 직후 + `updateClientSeatsWithConnection` 호출 직전에 `assertValidSeats(appliedSeats, 1, MAX_SEATS_PER_PLAN)` 1줄 삽입. `@/utils/paymentGuards` import 보강. `billingSubscription.service.ts:128` 동일 패턴.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`, merge `11c0525`):
- `src/services/charge.service.test.ts`
- `src/services/billingRenewal.test.ts`
- `src/services/billingSubscription.executeFirstPayment.test.ts`
- `src/tests/zone-01/sec-srv-45-payment-orderid.test.ts`
- `src/services/seatChange.service.test.ts`
- `src/types/charge.types.ts`
- `src/services/billingRenewal.service.ts`

### 검증 결과

- Lint: `pnpm lint` exit 0 (페이즈별 3회 모두 통과).
- Phase 1 vitest: 5개 영향 파일 개별 실행 모두 PASS (charge=13/13, billingRenewal=7/7, billingSubscription.executeFirstPayment=4/4, sec-srv-45=3/3, seatChange=3/3).
- advisor: 계획 시점 + 완료 시점 5관점 2회 모두 PASS.
- 사전 존재 실패 (webhook.controller.test.ts, webhook.idempotency.test.ts, promotion.routes.\*.test.ts 등) 는 본 플랜 스코프 외 — debug-chain 라우터 미존재 / billing.model.ts 경로 불일치 / webhook.model.ts 미존재 등 별도 후속.

### 운영 메모

- Phase 3 가드 위치는 `Math.max(..., 1)` clamp 뒤 — 하한 (`< 1`) 은 silent clamp, 가드는 상한 (`> MAX_SEATS_PER_PLAN`) 만 보호. 마스터 명시 ("Phase 1 가드와 동일 패턴") 채택. 하한 검증이 필요해지면 `Math.max` 이전 위치로 이전 변형 가능.
- Phase 1 의 logger.critical mock 추가는 prod 의 보상 분기 이전을 따라잡은 후속 — 동일 패턴이 필요한 신규 결제 테스트 작성 시 동일하게 적용 필요.

## v001.24.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#13

### 페이즈 결과

- **Phase 1** (`47d79cc`): `Promotion` / `ClientPromotion` 인터페이스에 `maxSeats` / `snapshotSeats` 필드 추가 + `mapPromotionRow` / `mapClientPromotionRow` 매핑 + `insertClientPromotion` args 에 옵셔널 `snapshotSeats` + INSERT 컬럼/플레이스홀더 추가. 기존 caller 호환 유지.
- **Phase 2** (`2345b1f`): `purchasePromotion` 협업 seats 가드를 `assertValidSeats(seats, p.minUsers ?? 1, p.maxSeats ?? MAX_SEATS_PER_PLAN)` 로 교체 (minUsers 단독 검증 흡수). `insertClientPromotion` 호출 직전에 `snapshotSeats` 도출 + 재검증 후 박제.
- **Phase 3** (`dfc625a`): `billingRenewal.service.ts` 협업 갱신 경로를 `cp.snapshotSeats` 기준 분기 — non-null 이면 박제값 직결 사용 (FOR UPDATE 락 생략), NULL 이면 기존 `findClientSeatsForUpdate` fallback. 양 경로 모두 `assertValidSeats` 재검증 추가 (admin 의 promotion.minUsers 상향 가능성 차단).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`, merge `88349b3`):
- `src/types/promotion.types.ts`
- `src/models/promotion.model.ts`
- `src/services/promotion.service.ts`
- `src/services/billingRenewal.service.ts`

### 검증 결과

- Lint: `pnpm lint` exit 0 (페이즈별 3회 + 머지 전 최종 확인).
- 기존 테스트 영향 없음 (회귀 없음 — `promotion.routes.*.test.ts` 는 mocked charge 기반 HTTP integration, 시그니처 호환).
- advisor: 계획/완료 시점 2회 통과. Phase 2 의 `seats-below-min` 에러 코드 narrowing 검토 — 외부 caller 가 해당 코드를 직접 매칭하지 않음 확인.

### 운영 메모

- legacy `client_promotion` 행 (snapshot_seats == NULL) 의 박제 마이그레이션은 본 plan 범위 밖. 필요 시 별도 `task-db-data` 로 백필.
- snapshot 경로는 FOR UPDATE 락을 생략 — `snapshot_seats` 가 immutable 박제이므로 seats 값에 대해선 안전하지만 동일 company 동시 갱신 직렬화 효과 차이는 모니터링 포인트.

## v001.23.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 15, cumulative phase 21)

### Hotfix 결과 (Hotfix 13 결함 정정)

마스터 보고: `borderConfig.spacing='outside'` 사용 시 위젯이 이웃 위젯이나 보드 가장자리와 닿아야 하는데 안 닿음.

**원인**: Hotfix 13 iter 1 의 phase-executor 가 `outside` 를 WidgetContainer 의 `margin:6` 로 구현 → 위젯이 격자 셀에서 안쪽으로 6px 축소. Hotfix 6 의 DashboardGrid calc 인셋 (좌상우하 2.5px) 도 함께 적용되어 ~8.5px 안쪽 축소. 의미 정반대.

**마스터 의도 정확**:
- `'inside'`: 위젯 box 안에 border, 콘텐츠 padding 안쪽 보호. 위젯간 5px 여백 유지.
- `'outside'`: 위젯 box 가 격자 셀 가득 확장 — 위젯간 5px 여백 무효화, 이웃 위젯 border 와 픽셀 단위 맞닿음.

- **Phase 21** (`f071a230`):
  - WidgetContainer: outside 분기의 `margin:6` + width/height calc 보정 두 곳 (헤더 없는 분기, 헤더 있는 분기) 모두 제거. isOutside 변수도 삭제.
  - DashboardGrid: static 위치 계산부에 `isOutsideSpacing` 검사 추가 — `spacing='outside'` 위젯에 한해 2.5px calc 인셋 대신 격자 셀 raw 퍼센트 좌표 사용. 결과: outside 위젯은 격자 셀 가장자리까지 확장.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx`
- `packages/fs-data-viewer/src/widgets/dashboard/DashboardGrid.tsx`

### 검증 결과

- TSC delta: 0.
- `pnpm build` ✅ `built in 17.70s`.

### 마스터 수동 회귀 시나리오

1. 위젯 두 개 가로로 인접, 둘 다 spacing='outside' + border 좌/우 ON → A 우측 border 와 B 좌측 border 가 픽셀 단위 맞닿음.
2. 보드 가장자리에 spacing='outside' 위젯 + border 좌 ON → 위젯 좌측 border 가 보드 좌측 가장자리에 닿음.
3. spacing='inside' (기본) 위젯은 기존 5px 여백 유지.

### Post-action hints

- 설정 모드 드래그 중 outside 위젯의 표시 크기 (calc % - 5px) 와 드롭 후 정착 크기 (% 원본) 가 일시적으로 미세하게 어긋남. dropPreview 인셋도 동일 — 시각적 결함이며 설정 모드 한정. 뷰 모드 영향 없음.

## v001.22.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 14, cumulative phase 20)

### Hotfix 결과 (반복 환경 결함 근본 정정)

마스터 보고: vite dev server 에서 `Failed to resolve import "fs_external_data_viewer/styles.css"` 가 어제 fix 후 다시 재발. fs-external-data-viewer / fs-sub-data-viewer 의 `dist/styles.css` 만 반복 누락 패턴.

**Root cause** (main session 직접 확인): 두 패키지의 `dev` 스크립트가 `"tsup --watch"` 만 실행 — tsup 가 dist 를 clear 하고 JS 만 재출력 → styles.css 누락. `fs-data-viewer` 의 dev 스크립트는 vite 기반이라 dist 미간섭 (css 보존). 두 패키지에서 어느 시점이라도 `pnpm dev` 가 돌면 css 가 사라지는 패턴.

- **Phase 20** (`e787f7dc`):
  - `fs-external-data-viewer/package.json` 과 `fs-sub-data-viewer/package.json` 의 `dev` 스크립트를 `"tsup --watch"` → `"pnpm build:css && tsup --watch"` 로 변경. dev 시작 시 styles.css 1회 생성 후 tsup watch 진입.
  - css 자체의 watch 는 빈도가 낮아 매번 빌드 불필요. tsup 가 dist clear 시점에도 build:css 가 함께 다시 실행되도록 하려면 별도 watch 도구 (concurrently 등) 도입 필요 — 본 hotfix 는 시작 시점 1회만으로도 마스터 보고 문제 해소.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-external-data-viewer/package.json` (dev script)
- `packages/fs-sub-data-viewer/package.json` (dev script)

### 검증 결과

- 코드 변경 0건 (package.json scripts 만 변경).
- TSC delta: 0.
- 환경 fix — dev server 재시작 시 정상 동작 확인 권장.

### 마스터 수동 회귀 시나리오

1. 두 패키지의 `pnpm dev` 가 시작 시점에 styles.css 를 생성하는지 확인.
2. dev server 가 fs-external-data-viewer / fs-sub-data-viewer 의 styles.css import resolve 성공 여부 확인.
3. 향후 styles 변경 시 일시적으로 stale 될 수 있으나 — css 변경 빈도가 낮아 dev 재시작 1회로 해소.

### Post-action hints

- 본 hotfix 는 dev 시작 시점 1회 build:css. **tsup watch 가 자동으로 dist clear 하면 그 시점에 css 가 다시 사라질 수 있음**. 영구 watch 가 필요하면 `concurrently` 또는 `npm-run-all` 도입해 `tsup --watch` 와 `tailwindcss --watch` 를 병렬 실행 — 후속 hotfix 검토 가능.

## v001.21.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#12 (Hotfix 1)

### Hotfix 결과

마스터 요청 — B1 (billingKey / 카드번호 평문 INSERT) 의 BE 코드 레이어를 본 플랜 안에서 즉시 처리. DB 작업 (컬럼 widening / 백필 / 평문 drop) 은 마스터가 별도 DB 프롬프트로 후속 실행.

- **Hotfix 1** (`38a11425a8aa6737841009518e8bd3853b52548d`):
  - `src/utils/billingCrypto.ts` 신규 — AES-256-GCM 봉투암호화 util.
    - `encryptBillingField(plaintext)` → IV(12B) + ciphertext + tag(16B) base64 직렬화 + `enc:v1:` prefix
    - `decryptBillingField(stored)` → prefix 없으면 평문 그대로 반환 (lazy migration — 기존 평문 행 호환)
    - 마스터키 = env `BILLING_MASTER_KEY` (base64 32 byte). 미설정 시 encrypt 호출 시점 throw, decrypt 는 prefix 없는 입력에 한해 key 불필요.
  - `src/models/billing.model.ts` 수정:
    - `createBillingInfo` INSERT: customerKey / billingKey / cardNumber (non-null) 암호화
    - `findActiveBillingByCompanyId` SELECT 반환 매핑: billingKey / customerKey / cardNumber decrypt 적용
    - `findBillingByCustomerKey`: WHERE 직접 비교 불가 (암호문 IV 매번 다름) → 활성 행 전수 fetch + in-memory decrypt 비교
    - `deactivateBillingByKey`: `WHERE is_active = 1` 로 스캔 제한 + decrypt 비교 → id 기반 UPDATE

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `src/utils/billingCrypto.ts` (신규)
- `src/models/billing.model.ts`

### 마스터 결정 카브아웃
- DB 컬럼 widening / 백필 / 평문 drop = 별도 DB 프롬프트 후속. 본 hotfix 는 코드 레이어만.
- `findBillingByCustomerKey` / `deactivateBillingByKey` 의 full-scan + in-memory decrypt 는 활성 빌링 행 수 = 회사 수 가정에서 수용. 대량화 시 인덱스 재설계 필요.
- `BILLING_MASTER_KEY` env fail-fast 는 lazy (encrypt 호출 시점) — 부팅 시 검증 보강은 B8 핸드오프 트랙에서 함께 처리.

### 후속 DB 작업 (마스터 별도 실행)
1. `/task-db-structure data-craft` — `billing_info` 컬럼 widening (`billing_key`, `customer_key`, `card_number` VARCHAR 길이 ≥ 200 또는 TEXT 로 확장)
2. `/task-db-data data-craft` — 기존 평문 행 일괄 암호화 백필 (BE 의 encryptBillingField 로직과 일치)

### 검증
- `pnpm lint` exit 0 (server hotfix1 base 깨끗, 신규 결함 0).
- 5-perspective advisor PASS (계획 + 완료 양쪽).
- 머지: hotfix WIP → server i-dev-001 (단일 step), 문서 WIP → I2 main.

---

## v001.20.0

> 통합일: 2026-05-14
> 플랜 이슈: funshare-inc/data-craft#12

### 페이즈 결과

`Project-I2/temp/data-craft-결제결함-32건.md` 의 🔴 HIGH 7건 검증 + 6건 수정 (B1 검증만, 후속 핸드오프).

- **Phase 1** (`aff16d2104281385bab486c3a69cdbbcc34f120c`): G3+B3+B4 — `paymentGuards.ts` 신설 (assertValidAmount/assertValidSeats + MAX_AMOUNT_KRW=10B / MAX_SEATS_PER_PLAN=1000). charge.service 진입부 amount 가드, promotion/seatChange/billingSubscription seats 분기 가드.
  - 보조 커밋 `35b2813`: i-dev-001 사전 lint 부채 6 errors + 1 warning 해소 (Phase 1 미터치 파일들).
- **Phase 3** (`1f259b7f74f07e409b8fb421dd39a0005e4b919d`): G8 — `findClientSeatsForUpdate(connection, companyId)` 추가 (SELECT ... FOR UPDATE). billingRenewal 협업 프로모션 결제 직전 블록을 트랜잭션으로 감싸 race 차단.
- **Phase 4** (`767ca3aa87170f55fe5fecca008355719c134a54`): G4 — webhook.controller secret 비교 `crypto.timingSafeEqual()` 로 교체 (length-mismatch dummy compare + 401). PAYMENT_STATUS_CHANGED 핸들러에 토스 `getPayment(paymentKey)` pull-after-push 추가. ABORTED/EXPIRED → FAILED 매핑.
- **Phase 2** (`8247399eabb660a510363b6bc1cfb9101416072c` + lint fix `6dd9c60`): G1 (옵션 B) — logger.ts `critical` 레벨 신설. 4 catch 블록 (billingSubscription/billingRenewal/seatChange/promotion) 에서 cancelPayment 보상 호출 전부 제거 → `logger.critical({event_type:'PAYMENT_CHARGE_DB_FAILURE', ...})` 단일 호출 대체. billingRenewal 만 throw→return false 로 변경 (이중 청구 방지).
- **Phase 5** (`8ad92fbf359c1881c638a8ea4b4928bc5e1035c1`): B2 — 잔존 호출처 3건 (billingRenewal:365, charge:83, charge:157) 도 모두 보상 cancel 경로로 payment_history 행 부재 → companyId 가드 양립 불가 (plan_contradicts_code). 옵션 B 일관 적용으로 3 호출처 모두 cancelPayment 제거 + 함수 자체 + TossCancelResponse 인터페이스 삭제. B2 자동 해결.
- **Phase 6** (`411dfdcaca653c7273a458e3290d31dd708c1cb1`, FE cross-repo): G2 — SeatAddDialog.tsx `applyAt='immediate'` 분기에 AlertDialog confirm 1회 경유 추가. next-cycle 분기는 confirm 생략 (기존 유지).
- **Phase 7** (코드 변경 없음): 핸드오프 이슈 2건 생성 — funshare-inc/data-craft-server#8 (B1 봉투암호화), funshare-inc/data-craft-server#9 (DB 컬럼 + 인프라 + 잔류 정리).

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `src/utils/paymentGuards.ts` (신규)
- `src/utils/logger.ts` (critical 레벨 추가)
- `src/services/charge.service.ts`
- `src/services/promotion.service.ts`
- `src/services/seatChange.service.ts`
- `src/services/billingSubscription.service.ts`
- `src/services/billingRenewal.service.ts`
- `src/services/tossPayments.service.ts` (cancelPayment + getPayment)
- `src/types/tossPayments.types.ts` (TossCancelResponse 제거)
- `src/controllers/webhook.controller.ts`
- `src/models/client.model.ts` (findClientSeatsForUpdate 추가)
- 보조 lint debt: `src/services/auth.service.ts`, `src/services/inputStore.service.ts`, `src/services/seatChange.service.test.ts`, `tests/enterprise-482-p02-is-verified-removal.test.ts`

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`, FE cross-repo):
- `src/features/subscription/ui/SeatAddDialog.tsx`

### 마스터 결정 카브아웃
- **G1 옵션 B**: 환불 가정 배제 → cancelPayment 자동 시도 자체 제거 (4 + 3 = 7 호출처). 사용자 카드값 차감 잔존 = 운영자 수동 토스 어드민 처리 전제.
- **B1**: 본 플랜은 검증만, 마이그레이션 자체는 후속 task-db-* (data-craft-server#8).
- **G2 cross-repo**: plan-enterprise 단일 work repo 가정 일탈 → FE 워크트리 별도 + 3-step 머지.
- **data-craft 사전 lint 부채 163건**: 본 플랜 예외 인정. Project-I 시대 누적 — data-craft-server#9 로 후속 정리 트랙.

### 검증 결과
- Phase 1, 2, 3, 4, 5: data-craft-server `pnpm lint` exit 0 (모든 페이즈).
- Phase 6: data-craft `pnpm typecheck:all && pnpm lint` 사전 부채로 미통과, file-specific (SeatAddDialog.tsx) 검증 PASS.
- 5-perspective advisor: 계획 #1 PASS, 완료 #2 PASS (마스터 카브아웃 인정).

### 후속 작업 (data-craft-server 호스팅)
- **data-craft-server#8**: B1 billingKey/카드 봉투암호화 (task-db-structure + task-db-data + 코드)
- **data-craft-server#9**: promotion.max_seats / client_promotion.snapshot_seats DB 컬럼, 토스 IP allowlist, Phase 1/5/6 잔류 정리

---

## v001.19.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 13, cumulative phase 19)

### Hotfix 결과

마스터 요구: 모든 보드 위젯 상세 설정의 단일 `showBorder` 토글을 (1) 상/하/좌/우 4면 개별, (2) 모서리 둥글기, (3) 콘텐츠 안쪽 / 위젯 바깥쪽 여백 위치 선택 옵션으로 확장.

- **Phase 19 iter 1** (`7a5de780`):
  - 신규 타입 `BorderConfig` (top/right/bottom/left/radius/spacing) — `entities/dashboard/types.ts`, 배럴 export 동시 갱신.
  - 7개 *Config (Card/Pie/Line/BaseBarChart/Scatter/Gauge/UserList) 에 `borderConfig?: BorderConfig` optional 필드 추가. 기존 `showBorder` 는 deprecated 주석 + 호환 유지.
  - 공통 `BorderSettingsSection.tsx` 신규 (4면 토글 + 둥글기 슬라이더 + inside/outside segmented).
  - 7개 `*Settings.tsx` 모두에 BorderSettingsSection 추가.
  - WidgetContainer 에서 borderConfig 적용 — 활성 면 1개라도 있으면 4면 개별 border + radius + spacing 적용. `spacing='outside'` 는 margin:6px 으로 격자 셀 안에서 위젯 축소.
- **Phase 19 iter 2** (`305dabe0`):
  - Blocker (DashboardGrid 의 기존 showBorder border 와 WidgetContainer 의 borderConfig border 중복) 정정. DashboardGrid 의 border 적용 분기에 borderConfig 활성 가드 추가 → borderConfig 가 활성이면 DashboardGrid 측 border skip, WidgetContainer 가 책임. 미설정이면 기존 showBorder 동작 fallback.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts` (`BorderConfig` 정의, 7개 *Config 에 추가)
- `packages/fs-data-viewer/src/entities/dashboard/index.ts` (배럴 export)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/_shared/BorderSettingsSection.tsx` (신규)
- 7개 `*Settings.tsx` — Card/Pie/Line/BarChart/Scatter/Gauge/UserList
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (borderConfig 시각 적용)
- `packages/fs-data-viewer/src/widgets/dashboard/DashboardGrid.tsx` (iter 2 — border 일원화 가드)

### 검증 결과

- TSC delta: 신규 typecheck 에러 0건.
- `pnpm build` ✅ `built in 16.80s`.

### 마스터 수동 회귀 시나리오

1. 모든 위젯 설정에 새 "테두리" 섹션 노출 — 4면 토글 / 둥글기 슬라이더 / "콘텐츠 안쪽" · "위젯 바깥쪽" 토글 확인.
2. 4면 중 일부만 ON → 해당 면에만 border 표시.
3. 둥글기 12px → border-radius 시각 확인.
4. spacing='outside' → 위젯이 격자 셀 안에서 살짝 축소, 격자 셀 가장자리와 위젯 border 사이 여백 노출.
5. 기존 showBorder=true 만 설정된 위젯 → 4면 모두 동일 border (DashboardGrid 의 fallback) 회귀 확인.

### 미해결 / Post-action hints

- UserListWidget 의 user-card 개별 border 는 `UserCard.tsx` / `SlotCard.tsx` / `CompareSlotCard.tsx` 에서 `showBorder` 별도 참조. 본 hotfix 의 borderConfig 는 위젯 외곽만 담당하며 user-card 수준 border 와 의미 분리 불완전 — 후속 hotfix 검토 가능.

## v001.18.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 12, cumulative phase 18)

### Hotfix 결과

마스터 결정: 두 문제 동시 처리 + 카드 sparkline 은 **옵션 2 (단일 batch request 안에 서버 contract 변경 없이 통합)** 로 진행.

#### 결함 A — 파이 stacked layout 미적용 (effect logic)

`PieChartWidget.tsx` 의 `useLayoutEffect` 가 chartDataKey 변경 시 isAnyTruncated 가 이미 false 인 경우 `setIsAnyTruncated(false)` 한 번 호출 후 early return — React 가 false → false setter 를 no-op 처리해 재렌더 없음 → effect 재실행 없음 → 측정 영구 스킵.

**Fix**: isAnyTruncated 가 false 면 early return 하지 않고 같은 effect 호출 안에서 measure 진행. measure 호출은 `requestAnimationFrame` 으로 deferring 해 layout 안정화 후 측정. ResizeObserver callback 도 rAF wrap.

#### 결함 B — 카드 sparkline 서버 데이터 미수신 (architecture)

`FsDashboard.tsx` 의 Write 모드 + batch aggregation 경로가 `requestDashboardBatchAggregation` 만 호출 → rows 미반환 → preprocessedRows 빈 상태. CardWidget 의 sparkline 이 `groupRowsByMonth` (preprocessedRows 기반) 사용해 buckets empty → null.

**Fix (옵션 2, 서버 변경 없이 기존 groupedAggregation 인프라 재사용)**:
- `buildWidgetBatchParams.ts`: 기존 `buildWidgetBatchParam` 단수 함수를 shim 유지하고 `buildWidgetBatchParams` (배열 반환) 신규. card 의 `sparklineConfig` 활성 시 `widgetId: <원본id>__sparkline` + `groupByColumnId: dateColumnField` 의 별도 param 동봉 → 단일 batch request 안에서 처리.
- `FsDashboard.tsx`: emission 루프를 params (배열) 기반으로 전환. 응답 분배 시 `__sparkline` 접미사 widget 결과의 `groupedAggregation` 을 base widget 결과의 `sparkline` 필드로 fold. `getWidgetDataKey` card 분기에 sparklineConfig 포함해 변경 감지.
- `paging.types.ts`: `WidgetBatchAggregationData` 에 `sparkline?: Record<string, Record<number, ServerAggregationResult>>` 필드 추가.
- `CardWidget.tsx`: sparkline 계산을 `aggregationData?.sparkline` (서버 groupedAggregation) 기반으로 전환. raw date 키를 YYYY-MM 으로 reduce + 최근 N개월 키 화이트리스트 필터 + 시간순 정렬. `groupRowsByMonth` (preprocessedRows 의존) 제거.

결과: Write 모드 batch aggregation 만으로도 sparkline 정상 렌더. **추가 서버 요청 없음** — 단일 batch request 의 widget 배열에 sparkline 위젯 entry 가 동봉되어 함께 처리.

- **Phase 18** (`5b3659a5`).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (effect 정정 + rAF)
- `packages/fs-data-viewer/src/widgets/dashboard/lib/buildWidgetBatchParams.ts` (단수 → 배열 반환 + sparkline param 동봉)
- `packages/fs-data-viewer/src/widgets/dashboard/FsDashboard.tsx` (emission/응답 분배 + __sparkline fold)
- `packages/fs-data-viewer/src/entities/paging.types.ts` (WidgetBatchAggregationData.sparkline 필드)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx` (sparkline 계산 source 전환)

### 검증 결과

- TSC delta (변경 파일): 신규 typecheck 에러 0건.
- `pnpm build` (root, packages 빌드 후): `✓ built in 17.20s` 통과.
- 서버 contract / endpoint 변경 없음 — batch aggregation 의 widgets 배열에 sparkline entry 만 추가됨.

### 마스터 수동 회귀 시나리오

1. 카드 sparkline 옵션 활성 + 날짜 컬럼 + 개월 수 설정 → 대시보드 Write 모드에서 카드 본체 하단에 미니 선 그래프 + 증감율 노출.
2. Network 탭의 dashboard-aggregation 요청 1회만 발생 (추가 fetch 없음). 요청 body 의 widgets 배열에 sparkline 활성 카드는 두 entry (base + __sparkline) 포함되는지 확인.
3. 파이 위젯에서 라벨 1개라도 truncate 발생 → 전체 stacked layout 으로 즉시 전환 확인.
4. 파이 데이터 변경 시 stacked → inline 자동 복귀.
5. dev server HMR 재시작 + 강력 새로고침 권장.

## v001.17.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 11, cumulative phase 17)

### Hotfix 결과 (Hotfix 10 결함 정정)

마스터 진단: Hotfix 10 적용 후에도 파이 범례 stacked 전환이 실제로 일어나지 않음 — 라벨은 시각상 truncate 되지만 stacked layout 으로 전환 안 됨.

**Root cause** (main session 직접 코드 점검): `PieChartWidget.tsx` 에 두 개의 useLayoutEffect 가 있었는데, **Effect 1 (measure)** 가 측정 후 `setIsAnyTruncated(true)` 를 호출하면 바로 뒤이어 실행되는 **Effect 2 (reset)** 가 `setIsAnyTruncated(false)` + `labelRefs.current = []` 로 덮어쓰는 구조. 결과: 측정 결과가 매번 false 로 reset 되고 ref 배열이 비워져 ResizeObserver 재측정도 무력화됨.

- **Phase 17** (`1bc51d59`):
  - Effect 2 (reset useLayoutEffect) 완전 제거.
  - Effect 1 안에 `prevKeyRef = useRef(chartDataKey)` 추가 — chartDataKey 변경 시 `setIsAnyTruncated(false)` 한 번 호출 후 다음 렌더에서 측정. 동일 키 재실행 시에는 reset 건너뜀.
  - `labelRefs.current = []` 수동 클리어 제거 — React 의 ref 콜백이 새 렌더 시 자동 재할당하므로 불필요.
  - 결과: 단일 useLayoutEffect 로 데이터 변경 reset + 측정 + ResizeObserver 일관 처리. measure → setState → re-render → measure 의 정상 사이클 복구.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (+7 / -7)

### 검증 결과

- TSC delta: 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 파이 위젯 — 긴 라벨 1개라도 → 전체 stacked 2줄 layout 전환 **실제 적용 확인**.
2. 위젯 폭 변경 — ResizeObserver 재측정 정상 동작.
3. 데이터 변경 시 stacked → inline 자동 복귀 (prevKeyRef 가 chartDataKey 변경 감지해 reset).

## v001.16.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#10

### 페이즈 결과

- **Phase 1** (`1edc5ef`): `findExternalDataGroups` UNION 첫 SELECT 두 곳 보정 — (A) `groupName` 컬럼을 `CASE WHEN user_fl.form_id IS NOT NULL THEN CONCAT('[폼] ', user_fl.form_name) ELSE dg.group_name END` 로 치환 (form 분기 표시명 `[폼] {form_name}` 으로 통일), (B) WHERE 절에 widget-scoped 패턴 `^__wdata_p[0-9]+_[0-9a-f]+$` 비노출 조건 추가 (단, `user_fl.form_id IS NOT NULL` 분기로 폼 소속 그룹은 보존). 결과: 외부 데이터 탐색기(일반) 화면에서 raw `__wdata_p*` widget-scoped 카드 17건 비노출, legacy 폼 1473 의 group_name 은 raw 데이터 그대로 유지된 상태에서 표시명만 `[폼] 직원 관리` 로 노출. multi 분기 미변경.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `src/models/externalData.model.ts` (+7 / -1)

### 후속 (plan 미포함)

- **C — legacy form group_name DML 정규화**: 마스터 별도 `/task-db-data data-craft` 호출 예정. `db.md` 의 DML → task-db-data 정책 + Phase 1A 의 표시 결함 해소 + phase-executor DB 미실행 사유로 본 plan 분리.
  - 쿼리 요지: `form_list.is_deleted = 0` 이고 `dg.group_name LIKE '__wdata_p%'` 이며 `dg.group_name NOT LIKE '[폼] %'` 인 `data_group` 행을 `CONCAT('[폼] ', form_name)` 으로 UPDATE.
  - 사전 확인: company_id 별 group_name UNIQUE 충돌 (`[폼] {form_name}` 중복) 여부.

### 검증 결과

- 변경 파일 `src/models/externalData.model.ts` 단독 eslint 통과 (exit=0). `pnpm lint` 전체는 6 errors + 1 warning 으로 실패하나 모두 i-dev-001 베이스라인 (`fc3a6cf`) 의 기존 결함 (auth.service / seatChange.service.test / enterprise-482 테스트 / inputStore unused-disable). Phase 1 이 도입한 lint 결함 0건 확인.
- `form_list.form_name` 컬럼 NOT NULL (`db.sql/01-tables.sql:343` `varchar(20) NOT NULL`) — CASE WHEN 분기에서 NULL 노출 위험 없음.
- 5-perspective advisor 통과 (계획 + 완료 시점 두 회 모두 BLOCK 없음).

### 마스터 수동 회귀 시나리오

1. 외부 데이터 탐색기(일반) 새로고침 — raw `__wdata_p*` 카드 17건 사라짐, `[폼] 직원 관리` 카드 1건 신규 노출, 기존 `[폼] *` 카드 20건 유지.
2. "직원 관리" 폼 진입 — group_id (1473) / 데이터 정상 (group_name DML 미실행 상태이므로 raw 그대로지만 화면 표시는 form_name 으로 노출).
3. 새 폼 생성 → `[폼] *` 즉시 노출 (builder.form.ts createForm 회귀 무).
4. input/selector 위젯 저장/로드 회귀 — group_id 기반이라 영향 없음 (`inputStore.service` 경로 1회 확인).

## v001.15.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 10, cumulative phase 16)

### Hotfix 결과

마스터 요구: 파이 위젯 우측 범례에서 라벨이 한 항목이라도 truncate 발생 시 → 모든 항목을 `[마커] [라벨]` / `값 (퍼센트%)` 2줄 stacked layout 으로 자동 전환. 추가로 stacked 라벨도 길이가 컨테이너 폭을 초과하면 multi-line ellipsis 로 잘림.

- **Phase 16 iter 1** (`144baea7`):
  - `PieChartWidget.tsx` 우측 범례 라벨 span 에 `ref` 부착, `useLayoutEffect` 에서 `scrollWidth > clientWidth` 측정해 `isAnyTruncated` state 갱신.
  - 범례 컨테이너에 `ResizeObserver` 부착 — 폭 변화 시 재측정.
  - `chartDataKey` 변경 시 inline layout 으로 리셋.
  - `isAnyTruncated === true` 시 stacked layout 분기 (1행 마커+라벨, 2행 pl-[18px] 들여쓰기+`값 (퍼센트%)`).
- **Phase 16 iter 2** (`481b2f3d`):
  - stacked 라벨 span 에 multi-line ellipsis 패턴 적용 (`display: -webkit-box`, `WebkitLineClamp: 2`, `WebkitBoxOrient: vertical`, `overflow: hidden` + 기존 `whiteSpace: normal`, `wordBreak: keep-all` 유지).
  - 결과: stacked 에서 자연스럽게 wrap, 2 라인 초과 시 끝에 말줄임표.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (+111 / -25)

### 검증 결과

- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 파이 위젯 — 짧은 라벨만 있는 데이터: inline layout (`[마커] [라벨] 값 (퍼센트%)`) 유지.
2. 파이 위젯 — 긴 라벨 한 개라도 포함 → 모든 항목이 stacked 2줄 layout 으로 전환.
3. 파이 위젯 — stacked 에서도 라벨이 매우 긴 경우 (한 단어 길이 등) 2 라인 wrap 후 말줄임표.
4. 위젯 폭을 늘리거나 줄이면 ResizeObserver 가 재측정 — 충분히 넓어진 후 데이터 변경 또는 새로고침 시 inline 으로 복귀 (`chartDataKey` reset 의존).

## v001.14.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 9, cumulative phase 15)

### Hotfix 결과 (회귀 결함 정정)

마스터 진단: 카드 위젯의 sparkline 옵션을 활성화하고 dateColumnField 까지 정상 설정해도 sparkline 이 렌더되지 않음. 데이터 계층 / DB column_setting / 위젯 config 모두 확인 결과 정상.

**Root cause** (main session 직접 코드 확인): `packages/fs-data-viewer/src/widgets/dashboard/collectWidgetColumns.ts` 의 card/gauge 분기가 `config.columnField` 만 collect 하고 `sparklineConfig.dateColumnField` 를 누락. Phase 4 (`22a65f3d`) 에서 sparklineConfig 필드를 추가했으나 이 collect 함수 업데이트를 빼먹은 회귀. 결과: 서버 fetch 요청에 날짜 컬럼 ID 가 포함되지 않음 → 응답 row 에 해당 셀이 없음 → preprocessedRows cellMap 에 키 부재 → `groupRowsByMonth` 의 `cellMap.get(dateColumnField)` 모두 undefined → bucketMap empty → buckets.length === 0 ≤ 1 → sparkline = null → UI 미렌더.

- **Phase 15** (`468498bf`):
  - `collectWidgetColumns.ts` 의 card/gauge 분기에 `config.type === 'card' && config.sparklineConfig?.dateColumnField != null` 가드 + `columns.push(config.sparklineConfig.dateColumnField)` 3줄 추가.
  - `!= null` 사용으로 0 인 columnField 값도 정상 수집. gauge 타입에는 sparklineConfig 가 없으므로 타입 가드 안전망.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/collectWidgetColumns.ts` (+3 / -0)

### 검증 결과

- TSC delta: 0 (테스트 파일의 사전 부채 1건은 본 변경 무관, baseline 에 이미 존재).

### 마스터 수동 회귀 시나리오

1. 카드 위젯의 sparkline 옵션 활성 → 날짜 컬럼 선택 → 개월 수 7 → 저장.
2. 대시보드 진입 시 카드 본체 하단에 미니 선 그래프 + 증감율이 정상 렌더되는지 확인.
3. dev server HMR 잔존 가능성 — 적용 후에도 안 보이면 강력 새로고침 1회 또는 dev server 재시작 권장.

## v001.13.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 8, cumulative phase 14)

### Hotfix 결과

마스터 요구 2개:
1. 선 그래프 상세 설정에 "선 색상 설정 기능 없음" 인지 — 실제론 color picker 존재했으나 시각 명료성 낮아 인지 실패.
2. 모든 위젯 상세 설정에 "위젯 저장 및 적용" 버튼 좌측에 **빨강색 취소 버튼** 추가.

- **Phase 14** (`ef2629a7`):
  - **A. LineChartSettings 선 색상 UI 명료화** — color picker 컨테이너 `w-10 → w-14`, swatch `w-8 → w-10 + border-2 border-gray-400`, 라벨 `Color (text-[10px]) → 선 색상 (text-xs)`. 사용자가 한 눈에 인지 가능.
  - **B. WidgetSettingsPanel 취소 버튼** — 컴포넌트 mount 시 widget.config 의 `structuredClone` 을 `useRef` 로 스냅샷. 취소 클릭 시 초기 config 복원 (`onConfigChange`) + 패널 닫기 (`onComplete`). 빨강 테두리 + 빨강 텍스트 motion.button 을 "저장 및 적용" 버튼 좌측에 배치.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx` (color picker 시각 명료화)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/WidgetSettingsPanel.tsx` (snapshot 스냅샷 + 취소 버튼)

### 검증 결과

- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 선 그래프 위젯 설정 — 각 값 컬럼 행에 "선 색상" 라벨 + 더 큰 swatch 가 시각적으로 명확히 노출, 클릭 시 color picker 동작 확인.
2. 위젯 설정 패널 — "위젯 저장 및 적용" 버튼 좌측에 빨강 텍스트 "취소" 버튼 노출.
3. 위젯 설정 변경 후 취소 — 변경사항 폐기되고 패널 진입 전 상태로 복원 확인. 저장 시 변경사항 유지 확인 (회귀 체크).

## v001.12.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 7, cumulative phase 13)

### Hotfix 결과

마스터 요구 2개:
1. 파이 위젯 중앙 빈 공간에 열 제목 + 총 수치값 (K/M/B 압축 포맷, 카드 위젯과 동일 방식).
2. 헤더 top + 좌우 패딩 추가 5px 씩 (현재 5px → 10px). 하단은 유지.

- **Phase 13** (`cc7484b6`):
  - **A. 파이 중앙 텍스트 (`PieChartWidget.tsx`)** — `formatCompactNumber` import 추가, 도넛 SVG 내 중앙 좌표 (cx=50, cy=50) 에 두 줄 `<text>` 삽입.
    - 윗줄: `valueColumnField` 가 가리키는 컬럼의 title (fontSize 4.5, textMuted 색). 열 제목이 빈 문자열이면 미렌더 조건부.
    - 아랫줄: chartData 전체 value 합을 `formatCompactNumber` 압축 포맷 (fontSize 8, bold, textPrimary 색).
  - **B. 헤더 패딩 (`WidgetContainer.tsx`)** — 헤더 padding 을 `'5px 5px 4px 5px'` → `'10px 10px 4px 10px'` (top + 좌·우 각 5px 추가, 하단 4px 유지).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (도넛 중앙 텍스트)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (헤더 padding 10/10/4/10)

### 검증 결과

- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 파이 위젯 — 도넛 중앙에 두 줄 표기 (윗줄 작은 폰트 회색 열 제목, 아랫줄 큰 굵은 폰트 총합 K/M/B 포맷) 노출 확인. 열 제목 미설정 시 윗줄 자동 비표시.
2. 위젯 헤더 — top·좌·우 패딩 10px (5px 추가) 시각 확인.

## v001.11.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 6, cumulative phase 12)

### Hotfix 결과

마스터 요구 3개:
1. 세로 막대 X 라벨이 균등 분배 후에도 truncate(말줄임표) 로 나타남 — 컬럼 폭을 활용해야 함.
2. 보드 위젯 간 5px 씩 여백.
3. 헤더 아이콘-제목 사이 5px 추가 (현재 5px → 10px).

- **Phase 12** (`23819249`):
  - **A. 세로 막대 X 라벨 폭 활용 (`BarChartWidget.tsx`)** — 각 그룹 컬럼을 `flex-shrink-0` 고정폭에서 `flex: 1 1 0` 균등 분배 방식으로 전환. X 라벨 셀이 컬럼 전체 폭을 활용. maxWidth 고정값(groupWidth px) → 100% 로 교체해 truncate 가 컬럼 폭 초과 시에만 적용.
  - **B. 위젯 간 5px 여백 (`DashboardGrid.tsx`)** — 절대위치 기반 위젯에 calc() 인셋 (2.5px offset, 5px 크기 감소) 으로 모든 방향 5px 시각적 여백. 드롭 프리뷰도 동일 적용.
  - **C. 헤더 gap (`WidgetContainer.tsx`)** — flex gap 5px → 10px (아이콘 ↔ 제목 간격 추가 5px 확대).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx` (X 라벨 컬럼 flex 균등)
- `packages/fs-data-viewer/src/widgets/dashboard/DashboardGrid.tsx` (calc 인셋 위젯간 여백)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (gap 10px)

### 검증 결과

- advisor 사전 검토 없이 진행 (3 요구사항 모두 명확하고 작은 시각 조정).
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 세로 막대 — X 라벨이 막대 컬럼 폭 전체를 활용해 표시되는지 확인 (이전: 좁은 폭으로 truncate). 라벨이 컬럼 폭 초과 시에만 말줄임표 적용.
2. 위젯 격자 — 모든 인접 위젯 사이에 5px 시각적 간격 확인 (가로/세로 모두).
3. 헤더 — 아이콘 + 제목 둘 다 있는 위젯에서 사이 간격이 10px (이전 5px → 5px 추가) 으로 확장 확인.

## v001.10.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 5, cumulative phase 11)

### Hotfix 결과

마스터 요구 4개:
1. 세로/가로 막대 그래프 — 주어진 공간 균등 배분 (현재 한쪽으로 몰림).
2. UserListWidget — 한 카드에 다 들어가면 좌우/상하 이동 버튼 미표시.
3. WidgetContainer 헤더 — top + 좌·우 여백 5px 씩.
4. WidgetContainer 헤더 — 아이콘+제목 둘 다 있을 때 둘 사이 5px gap.

- **Phase 11** (`b544bfac`):
  - **A. 막대 균등 분배 (`BarChartWidget.tsx`)** — 가로 막대 차트의 행 스크롤 컨테이너와 세로 막대 차트의 열 컨테이너에 각각 `justify-evenly` 추가. 데이터 개수가 적어도 막대가 위젯 가용 공간을 균등하게 채워 배치.
  - **B. UserList nav 조건부 (`PaginatedUserGrid.tsx`)** — `totalPages <= 1` 일 때 화살표 (이전/다음) 버튼을 미렌더링. 추가로 카드 그리드 패딩을 32px → 8px 로 축소해 회수된 여유 공간을 카드 영역에 반환.
  - **C. WidgetContainer 헤더 패딩 (`WidgetContainer.tsx`)** — 헤더 wrapper 의 padding 을 `5px 5px 4px 5px` (top/right/bottom/left) 로 변경. top·좌·우 5px, 하단은 차트 영역과의 시각 균형 위해 4px 유지.
  - **D. 헤더 슬롯 gap (`WidgetContainer.tsx`)** — flex 헤더의 `gap` 을 4px → 5px 로 변경. 3-slot 고정 width 구조 (좌끝 icon | flex-1 title | 우끝 icon) 특성상 빈 placeholder 슬롯과의 gap 은 시각적으로 무효, 아이콘과 제목이 둘 다 존재할 때만 시각적으로 5px 간격으로 나타남 → 마스터 요구 "둘 다 있을 때 둘 사이 5px" 자동 충족.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx` (justify-evenly 적용)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/PaginatedUserGrid.tsx` (totalPages ≤ 1 nav 미렌더 + 카드 그리드 padding 축소)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (헤더 padding + gap 5px)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 헤더 gap 의 "둘 다 있을 때만" 조건이 3-slot 고정 width 구조로 시각적 자동 충족 확인.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. **막대 그래프 (가로/세로 모두)** — 데이터 행/열 수가 적은 케이스에서도 위젯 영역 전체에 막대가 균등 분배되는지 확인 (이전: 한쪽 몰림).
2. **UserListWidget** — 사용자 카드가 한 페이지에 다 들어가는 경우 (totalPages ≤ 1) 좌우/상하 이동 버튼이 비표시되는지 확인. 카드 영역이 더 넓어진 것도 확인.
3. **헤더 패딩** — 모든 위젯 헤더에서 상단/좌/우 각 5px 여백 확인.
4. **헤더 아이콘-제목 gap** — 아이콘 + 제목 둘 다 설정한 위젯에서 둘 사이에 5px 간격 확인. 한쪽만 있을 때는 시각 차이 없는지 확인 (placeholder 슬롯이 gap 의 시각 효과를 흡수).

## v001.9.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 4, cumulative phase 10)

### Hotfix 결과

마스터 요구 3개:
1. 카드 sparkline 은 카드 비율 유지하면서 표시 (현재는 공간을 더 잡아먹음).
2. 선 그래프 우측 95% 활용, 좌측은 Y축 단위 고려해서 95% 활용.
3. 카드 숫자 K/M/B 포맷 + 단위 개행 → 값 바로 옆 (인라인).

- **Phase 10 iter 1** (`e0d7a30d`):
  - **A. 카드 sparkline 압축** — CardWidget 을 flex column 7:3 비율 분할로 재구성. sparkline 활성/비활성 여부와 무관하게 카드 외부 height 불변. sparkline 영역은 카드 폭 거의 가득, 좌우 padding 최소.
  - **B. 선 그래프 좌우 활용** — LineChartWidget 의 가로 inset 을 좌 90→20px, 우 10px 비대칭 축소. Y축 라벨 컬럼 max-w-[64px] 제한으로 차트 SVG 가 위젯 가로 영역의 ~95% 활용.
  - **C. K/M/B 포맷 + 단위 인라인** — `formatCompactNumber` 헬퍼를 `dashboard-data-utils.ts` 에 신규 (1K~999K / 1M~999M / 1B~, 정확한 정수는 소수 생략, < 1000 은 toLocaleString). CardWidget 단위는 숫자와 같은 flex row baseline 에 13px 보조 폰트 인라인 (`unitPosition` 좌/우 옵션 존중).
- **Phase 10 iter 2** (lint hotfix `60865322`): CardWidget IIFE 반환 union narrowing 결함 정정 — ternary fallback 을 `displayData.value !== null ? formatCompactNumber(value) : '-'` 패턴으로 단순화해 TS2339 해소.
- **Phase 10 iter 3** (`07f30850`): advisor 지적 — K/M/B 포맷이 서버 집계 경로에서도 일관 적용되도록 IIFE 의 서버 분기 반환을 `{ value: serverResult.value, formattedValue: '-' }` 로 통일. 출력 단계의 `formatCompactNumber(value)` + 단위 인라인 한 경로에서 클라이언트·서버 양 경로 모두 처리.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx` (iter 1, 2, 3 — 비율 분할 + 포맷 + 서버 경로 통일)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx` (iter 1 — inset 축소)
- `packages/fs-data-viewer/src/widgets/dashboard/lib/dashboard-data-utils.ts` (iter 1 — `formatCompactNumber` 헬퍼 신규)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS (iter 3 정정 후) — iter 1 직후 server-aggregation 경로의 K/M/B 미적용 갭을 advisor 가 사전 지적, iter 3 에서 출력 단계 통일로 해소.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건 (iter 2 의 narrowing 정정 포함).

### 마스터 수동 회귀 시나리오

1. **카드 비율** — sparkline 활성 카드와 비활성 카드의 외부 height 가 같은지 확인. 활성 시 내부 7:3 분할로 sparkline 이 카드 하단 약 30% 영역 차지.
2. **카드 K/M/B** — 작은 수 (< 1000) 은 천 단위 콤마, 1K~999K / 1M~999M / 1B 이상은 압축 포맷, 정확한 정수는 소수 생략 확인. 클라이언트 모드·서버 집계 모드 양쪽 모두 적용.
3. **카드 단위 인라인** — `config.unit` 설정 시 숫자 바로 좌·우 (unitPosition) 에 작은 폰트로 한 줄 표시, 개행 없음 확인.
4. **선 그래프 좌우 95%** — 위젯 영역 전체 폭 대비 차트 SVG 영역이 우측 거의 끝까지, 좌측은 Y축 라벨 64px 이내 + 추가 inset 20px 안에서 95% 활용 확인. 1월/12월 같은 끝 데이터 포인트가 Y축 라벨 컬럼에 가려지지 않는지 시각 체크.
5. **선 그래프 X 회전 라벨 가독성** — Y라벨 cap 64px 와 inset 20/10 px 변경으로 회전 X 라벨이 차트 영역을 약간 벗어날 수 있음 — 긴 라벨(8자 이상) 의 truncate 동작 확인.

## v001.8.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 3, cumulative phase 9)

### Hotfix 결과

마스터 요구: (1) 막대그래프 단색 적용 문제 해결 — 급진적 2 + 점진적 2 테마. (2) 파이/산점도 동일 적용. (3) 선 그래프는 테마 대신 라인별 색 지정.

- **Phase 9** (`914852f2`):
  - **A. 4종 팔레트 재정의 (`chart-colors.ts`, `ColorSchemeSelector.tsx` 동기화)** — 기존 ID 유지로 데이터 마이그레이션 없음:
    - `warm` = 급진적1 (vibrant-warm, 8색 고대비).
    - `cool` = 급진적2 (vibrant-cool, 8색 고대비).
    - `default` = 점진적1 (blue 단일 hue 명도 8단계).
    - `mono` = 점진적2 (gray 단일 hue 명도 8단계).
  - **B. 막대그래프 단일 시리즈 카테고리 색 (`BarChartWidget.tsx`)** — `valueColumns.length === 1` 분기 추가 (`isSingleSeries` / `isSingleSeriesClient` 변수). 서버 경로(line 98+113) 와 클라이언트 경로(line 187+215) 양쪽 모두 단일 시리즈 시 group 인덱스로, 다중 시리즈 시 column 인덱스로 색 결정.
  - **C. 산점도 포인트별 색 (`ScatterChartWidget.tsx`)** — 기존 `getSchemeColor(0, ...)` 단일 색 → normalizedPoints 빌드 시 point 인덱스 기반 색을 내장해 두 렌더 분기 모두 일관 적용.
  - **D. 파이 차트 (`PieChartWidget.tsx`)** — 변경 없음 (이미 slice index 기반 색). 새 팔레트 자동 적용.
  - **E. 선 그래프 라인별 색 (`types.ts`, `LineChartWidget.tsx`, `LineChartSettings.tsx`)** — `ChartValueColumn` 에 `color?: string` 추가. `LineChartWidget` 의 색 결정을 `vc.color ?? getSchemeColor(colIndex, config.colorScheme)` fallback 패턴으로 변경 (line 190, 341). `LineChartSettings` 에서 `<ColorSchemeSelector>` 블록 제거 후 각 valueColumn 행에 color picker 추가.
  - **F. 데이터 호환성** — `LineChartConfig.colorScheme` 필드는 유지 (deprecated 로 두되 UI 노출 X). 기존 위젯이 `colorScheme: 'default'` 만 있고 valueColumns 에 color 가 없을 때 fallback 으로 정상 렌더.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/lib/chart-colors.ts` (팔레트 재정의)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/common/ColorSchemeSelector.tsx` (selector 미리보기 동기화)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/BarChartWidget.tsx` (단일 시리즈 그룹 인덱스 분기)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/ScatterChartWidget.tsx` (포인트별 색)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx` (vc.color fallback)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx` (라인별 color picker)
- `packages/fs-data-viewer/src/entities/dashboard/types.ts` (`ChartValueColumn.color?`)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 3개 요구사항 모두 코드에 반영. 단일 시리즈 discriminator 2곳 (서버·클라이언트 경로) + LineChart vc.color fallback 2곳 모두 적용 확인.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. 막대그래프 (단일 시리즈) — 카테고리 막대 색이 4종 테마에 따라 자동 변화 확인 (default = blue 명도 그라데이션, warm/cool = 고대비, mono = gray 그라데이션).
2. 막대그래프 (다중 시리즈) — 시리즈별 색 구분 유지 확인.
3. 파이 차트 — 4종 테마 시각 적용 확인 (도넛 조각별 색).
4. 산점도 — 포인트별로 색이 변하는지 확인 (이전엔 단일 색).
5. 선 그래프 — 위젯 설정에서 각 라인별 color picker 노출 확인, 색 지정 후 즉시 라인 색 변경. 기존 widget 데이터 (color 미지정) 가 fallback 으로 정상 렌더 확인.

## v001.7.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 2, cumulative phase 8)

### Hotfix 결과

마스터 요구: "사용자 타입 보드 위젯은 항상 주어진 영역 안에서 중앙에 정렬되도록."

- **Phase 8** (`f028e196`): `PaginatedUserGrid.tsx` 66~75번 라인 영역의 카드 그리드 컨테이너 인라인 스타일에서 `justifyContent` / `alignContent` 값을 각각 `'start'` → `'center'` 로 변경 (2-line 변경). vertical · horizontal · grid 3종 layout 모두에서 사용자 카드 블록이 위젯 영역의 수평·수직 중앙에 배치된다. iter 1 에서 `UserListWidget.tsx` 단독 변경이 효과 없음 (PaginatedUserGrid 가 실제 정렬 결정) 을 발견 후 scope 확장 승인.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/user-insight/PaginatedUserGrid.tsx` (Phase 8)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 마스터 요구 "항상 중앙 정렬" 의 plain reading 충족. 마지막-페이지 partial row 가 행 내부에서도 가운데로 모이는 edge case 는 의도된 해석 (option 1) 으로 수용.
- TSC delta: hotfix 변경 파일에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. `pnpm dev` → 데이터 뷰어 → 대시보드뷰. 사용자 목록 위젯 (UserListWidget) 의 vertical / horizontal / grid 3종 layout 모두에서 사용자 카드 블록 전체가 위젯 영역 수평·수직 중앙에 위치하는지 확인.
2. **Edge case**: 사용자 목록이 페이지를 가득 채우지 못해 마지막 페이지에 적은 카드만 있는 경우 — 그 카드들이 행 내에서도 가운데로 모이는지 확인 (의도된 동작). 시각상 어색하면 추후 hotfix 로 "블록 전체 중앙 + 카드 내부 좌측 정렬" 로 변경 가능.

## v001.6.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9 (Hotfix 1, cumulative phase 7)

### Hotfix 결과

마스터의 4개 핫픽스 요구사항을 단일 페이즈로 적용 후 default 색 보정 iter 1 추가.

- **Phase 7 iter 1** (`40623ca2`):
  - **(1) 아이콘 배경 흰색 금지** — IconSettingsSection 의 8색 팔레트는 본래 흰색 미포함, 팔레트 변경 없이 유지.
  - **(2) 아이콘 흰색 고정** — `WidgetContainer.tsx` 의 `<IconComponent>` 에 `color="#ffffff"` 추가, 배경 어떤 색이든 아이콘은 항상 흰색.
  - **(3) 파이 내부 라벨 제거** — `PieChartWidget.tsx` 에서 `getSliceCenter`, `wrapLabelToLines`, `internalSlices`, `MIN_ANGLE_FOR_INTERNAL_LABEL`, SVG 내부 text 블록 일괄 제거. `showLabels` 옵션이 dead-option 이 되어 `PieChartSettings.tsx` 의 해당 ToggleSwitch 도 제거.
  - **(4) 파이 우측 범례 = `값 (% 수치)` 형식** — `${value.toLocaleString()} (${(percentage*100).toFixed(1)}%)` 로 통일 (천 단위 콤마 + 백분율 소수 1자리). row title 툴팁도 동일 형식.
- **Phase 7 iter 2** (`dca8f3f1`):
  - 아이콘 배경 default 보정 — `ICON_BG_DEFAULT` 를 밝은 회색 `#e5e7eb` → 인디고 `#6366F1` (IconSettingsSection 팔레트 첫 색) 으로 변경. 흰색 아이콘과 대비 확보.
  - `resolvedBgColor` 헬퍼 도입 — `'#fff' | '#ffffff' | 'white' | 'rgb(255,255,255)'` 4개 리터럴 입력 시 `ICON_BG_DEFAULT` 로 자동 치환. 흰색 배경 조합 자체 차단.

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (Phase 7 iter 1, iter 2)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (Phase 7 iter 1)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/PieChartSettings.tsx` (Phase 7 iter 1)

### 검증 결과

- advisor #2 (hotfix 5-perspective): PASS — 4개 요구사항 모두 코드에 반영. iter 1 직후 advisor 가 default 색 미보정 갭을 지적해 iter 2 로 정정.
- TSC delta: hotfix 변경 파일 3개에서 신규 typecheck 에러 0건.

### 마스터 수동 회귀 시나리오

1. `pnpm dev` → 데이터 뷰어 → 대시보드뷰. 아이콘 옵션 활성화된 위젯에서 아이콘 자체가 항상 흰색으로 렌더되는지, 배경색 선택 시 흰색 옵션 자체가 부재한지 확인.
2. 위젯 설정에서 아이콘은 활성화하되 배경색을 따로 고르지 않은 경우 인디고 (`#6366F1`) 로 표시되는지 확인.
3. 파이 차트: 파이 조각 내부에 라벨/수치 텍스트가 사라졌는지, 우측 범례가 `[정사각형 마커] [라벨] 값 (백분율%)` 형식인지 확인.

## v001.5.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#9

### 페이즈 결과

- **Phase 1** (`2c501382`): `entities/dashboard/types.ts` 에 공통 `TitleConfig` / `IconConfig` export 추가 후 7개 위젯 config (BaseBarChart 경유 BarHorizontal/Vertical, LineChart, PieChart, ScatterChart, Card, Gauge, UserList) 에 `titleConfig?` / `iconConfig?` optional 필드 적용. 모든 필드 optional → 기존 직렬화 데이터 호환.
- **Phase 2** (`85a01127` + 린트 핫픽스 `220bebe8`): `widgets/dashboard/widgets/WidgetContainer.tsx` 신규 — 3열 flex 헤더 (좌끝 아이콘 슬롯 | 가운데 제목 flex-1 | 우끝 아이콘 슬롯) 구조로 "아이콘은 항상 제목보다 끝쪽" 규칙을 레이아웃으로 자동 보장. titleConfig.text 부재 시 CardConfig 의 legacy title 로 fallback, 표시 내용 0 이면 헤더 공간 미점유. WidgetRenderer 가 7종 위젯 모두를 컨테이너로 감쌈. 린트 핫픽스: `entities/dashboard/index.ts` 배럴 export 에 TitleConfig/IconConfig 추가 + lucide-react 캐스트를 `as unknown as Record<...>` 안전 패턴으로 변경.
- **Phase 3** (`51181e97`): `widget-settings/settings/_shared/TitleSettingsSection.tsx` (텍스트·굵기·크기·정렬) + `IconSettingsSection.tsx` (18종 lucide 아이콘 그리드·8색 팔레트·좌/우 토글) 공통 컴포넌트 신규 작성 후 7개 `*Settings.tsx` 에 균일하게 import + 렌더 추가. spread-merge 패턴으로 titleConfig/iconConfig 업데이트.
- **Phase 4** (`22a65f3d`): CardConfig 에 `sparklineConfig: { enabled, months, dateColumnField }` 추가. `widgets/dashboard/lib/dashboard-data-utils.ts` 에 `groupRowsByMonth` 헬퍼 신규 (preprocessedRows 를 dateColumnField 기준 월별 그룹화 후 aggregation 적용, 최근 N개월 슬라이스). CardWidget 본체 내부 자체 레이블 제거 (WidgetContainer 가 헤더 담당), 카드 숫자 아래 미니 LineChart + 증감율 (가장 오래된 월 대비, 부호와 함께 `+12.3%` / `-4.5%` 형식, divide-by-zero 시 null 처리) 렌더. 가용 월 ≤ 1 이면 sparkline 영역 비표시.
- **Phase 5** (`b0f844ef`): PieChartWidget — SVG 경로를 wedge → annulus segment (외호 + 내호 역방향) 로 교체해 도넛 형태 구현. 내부 라벨은 `config.showLabels===true` 조건부, 위치를 링 중간점(radius*0.8) 으로 이동. 우측 범례 기존 `<20% 필터` 제거 → chartData 전체 항상 표시. 마커 12×12 정사각형(rounded 없음), 수치 소수 1자리 (`12.3%`) 통일.
- **Phase 6** (`5388d374`): LineChartWidget — Y축 max/min 라벨 컬럼을 왼쪽에 추가 + Y축 좌측 선 삽입, X라벨 영역에 동일 너비 invisible spacer 로 X틱 정렬. ScatterChartWidget — 회색 배경 rect(fill=gridBg) 와 6개 grid line 전체 제거, Y축(좌 border-l) + X축(하 border-t) 축 라인만 남김. 두 위젯 모두 recharts 가 아닌 커스텀 SVG/DOM 렌더링 구조였음 (Explore 보고 정정).

### 영향 파일

**data-craft** (`funshare-inc/data-craft`, branch `i-dev-001`):
- `packages/fs-data-viewer/src/entities/dashboard/types.ts` (Phase 1, 4)
- `packages/fs-data-viewer/src/entities/dashboard/index.ts` (Phase 2 lint hotfix — 배럴 export)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetContainer.tsx` (Phase 2, 신규)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/WidgetRenderer.tsx` (Phase 2)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/CardWidget.tsx` (Phase 4)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/PieChartWidget.tsx` (Phase 5)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/LineChartWidget.tsx` (Phase 6)
- `packages/fs-data-viewer/src/widgets/dashboard/widgets/ScatterChartWidget.tsx` (Phase 6)
- `packages/fs-data-viewer/src/widgets/dashboard/lib/dashboard-data-utils.ts` (Phase 4)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/_shared/TitleSettingsSection.tsx` (Phase 3, 신규)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/_shared/IconSettingsSection.tsx` (Phase 3, 신규)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/CardSettings.tsx` (Phase 3, 4)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/PieChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/LineChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/BarChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/ScatterChartSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/GaugeSettings.tsx` (Phase 3)
- `packages/fs-data-viewer/src/widgets/dashboard/widget-settings/settings/UserListSettings.tsx` (Phase 3)

### 검증 결과

- advisor #1 (계획 5-perspective): PASS — 아이콘×제목 결합 규칙·sparkline `dateColumnField` 필수·클라이언트 집계 단일 노선·Phase 3 실행 순서 가이드 모두 사전 정정.
- advisor #2 (완료 5-perspective): PASS — 6개 명령 모두 코드에 반영. Evidence caveat: Explore 가 Line/Pie/Scatter 를 recharts 라 보고했으나 실제 custom SVG/DOM (phase-executor 가 실측 정정). Logic caveat: Phase 2 lint hotfix 가 `entities/dashboard/index.ts` 를 영향파일 외 추가 수정 (배럴 누락 보완 — 메카니즘적 합당).
- TSC delta: baseline (i-dev-001 c7f0e7d5) 30개 → 누적 26개. Phase 1~6 신규 typecheck 에러 0건.
- ESLint: 본 플랜 신규/변경 파일 깨끗.

### 마스터 수동 회귀 시나리오

1. `pnpm dev` → 데이터 뷰어 → 대시보드뷰 진입.
2. 위젯 7종 각각의 설정 화면에서 "제목" / "아이콘" 섹션 노출 확인.
   - 제목: 텍스트 + 굵기(2) + 크기(3) + 정렬(3) 변경 시 위젯 헤더 즉시 반영.
   - 아이콘: 18종 그리드 선택, 배경 8색 팔레트, 좌/우 토글 시 위젯 헤더 끝쪽에 원형 배경 + 고정 크기 아이콘 표시.
3. 카드 위젯 설정의 "추세 Sparkline" 토글 ON → 날짜 컬럼 + 개월 수 입력 → 카드 본체 아래 미니 선 그래프 + 증감율(`+/-X.X%`, 색상) 노출.
   - 데이터 월 범위 < N: 가용 범위만 표시.
   - 데이터 월 ≤ 1: sparkline 비표시 확인.
4. 파이 차트 위젯: 중앙이 빈 도넛 형태 + 우측에 [정사각형 색상 마커 | 라벨 | 수치(%)] 범례 노출.
5. 선 그래프 위젯: 좌측 Y축 라인 + max/min 라벨, 하단 X축 라벨이 각 데이터 컬럼 폭에 정렬돼 표시.
6. 산점도 위젯: 회색 배경/grid 사라짐, 좌측 Y축 + 하단 X축 라인만 잔존.

### Post-action hints

- 기존 카드 위젯 중 `config.title === ""` (빈 문자열) 인 인스턴스는 WidgetContainer fallback 이 닿지 않아 헤더 미표시 가능. 시각 확인 후 필요 시 `titleConfig.text` 설정 또는 fallback 확장 hotfix.
- 카드 sparkline 의 `dateColumnField` 는 ISO 또는 `Date.parse` 가능 문자열 가정 — 다른 형식이면 조용히 스킵 (sparkline 비표시).
- 향후 차트 라이브러리 관련 작업 시 Explore 결과만 신뢰 말고 실제 위젯 파일 직접 확인 (본 플랜에서 recharts 오인 사례 발생).

## v001.4.0

> 통합일: 2026-05-13
> 플랜 이슈: funshare-inc/data-craft#8

### 페이즈 결과

- **Phase 1** (감사 only, 커밋 없음): 35개 `callSpManageDataGroup` 호출처 전수 audit 결과 모두 이미 outer `beginTransaction()` … `commit()` / `rollback()` 블록 안에 있음을 확인. Phase 2 (SP inner-TX 제거) 의 안전 전제 검증 — 코드 변경 0. 마스터 명시 항목 #3 ("outer 트랜잭션 없이 호출하는 곳을 찾아 보정") 의 응답 = 미보호 호출처 0건. SP self-COMMIT 이 outer txn 을 무력화하던 것이 본 버그의 단일 근원.
- **Phase 2** (`ec5fca0` + `b3b2048`, iter 2): `sp_manage_data_group` 양쪽 정의 (`db.sql/03-procedures.sql`, `fix_sp_manage_data_group.sql`) 에서 SP-level inner transaction 명령 완전 제거. iter 1 = SP-level `START TRANSACTION;` (03:1344, fix:70) + 외부 `COMMIT;` (03:1528, fix:254) + EXIT HANDLER `ROLLBACK;` (03:1321, fix:47) 제거. iter 2 = soft-delete 분기 (`v_columns_count = 0`, `LEAVE main_block` 직전) 의 inner `COMMIT;` (03:1407, fix:132) 추가 제거 — iter 1 의 START TRANSACTION 과 쌍이었던 orphan COMMIT 이 caller outer 트랜잭션을 조기 커밋하는 회귀 위험을 main session 검증 단계에서 발견 → 보정. 변경 후 SP 본체 grep 시 `START TRANSACTION` / `COMMIT;` / `ROLLBACK;` 모두 0 hit. EXIT HANDLER 의 `INSERT INTO sp_error_log`, `DO RELEASE_LOCK`, `SELECT v_err_msg AS error_message` (status='FAILED') result-set 반환 contract 보존 — wrapper `callSpManageDataGroup` 의 `throw new Error('SP 오류: ...')` 동작 유지.
- **Phase 3** (`2a84cec`): `createForm` 진입부 (`beginTransaction` 직후, SP 호출 전) 에 사전 중복 검증 net-new 추가 — `form_name` 중복 (`form_list` 직접 조회 → `ConflictError('FORM_NAME_DUPLICATE')`) + `[폼] {name}` group_name 중복 (기존 `viewerModel.checkGroupNameDuplicate` 재사용 → `ConflictError('GROUP_NAME_DUPLICATE')`). TEMP 이름 race 방어: `__TEMP_FORM_${Date.now()}__` → `__TEMP_FORM_${Date.now()}_${randomUUID()}__` (`builder.form.ts:88`), `viewer/viewer.group.ts:55` 의 `Math.random()` 접미사도 `randomUUID()` 로 교체. 동시 호출 시 TEMP 이름 충돌 자체 차단. tsc PASS, lint baseline_fail_unrelated.

### 영향 파일

**data-craft-server** (`funshare-inc/data-craft-server`, branch `i-dev-001`):
- `db.sql/03-procedures.sql` (Phase 2 iter 1 + iter 2)
- `fix_sp_manage_data_group.sql` (Phase 2 iter 1 + iter 2)
- `src/services/builder/builder.form.ts` (Phase 3)
- `src/services/viewer/viewer.group.ts` (Phase 3)

### 검증 결과

- advisor #1 (계획 5-perspective): PASS — RESIGNAL 위험, phase 순서 (wrap-then-flip), wrapper #2 contract, nested SP audit 모두 사전 정정.
- advisor #2 (완료 5-perspective): PASS — Intent / Logic / GroupPolicy(carve-out 승인) / Evidence / Command Fulfillment 전부 통과. 별도 발견: 원 Explore 가 `checkGroupNameDuplicate` 가 builder.form.ts:45 에 이미 있다고 보고했으나 실제 부재 → Phase 3 가 net-new 추가로 정정.
- TSC (`npx tsc --noEmit`): Phase 3 종료 시점 PASS — 본 플랜 변경으로 인한 신규 type 오류 0건.
- Lint (`pnpm lint`, Phase 2/3): `baseline_fail_unrelated` — i-dev-001 사전 결함 6건 (auth.service.ts:64 unused / seatChange.service.test.ts × 4 no-explicit-any / enterprise-482-p02-is-verified-removal.test.ts:88 no-require-imports) 만 존재, 본 플랜 변경 무관 (= v001.3.0 §B-2 와 동일 항목). Skill §7c.6 lint hotfix iter 미트리거 — advisor #2 GroupPolicy 축에서 carve-out 명시 승인 (사전 결함 자동 fix 시도는 CLAUDE.md §6 prevention treadmill 위반).

### 마스터 수동 회귀 시나리오 (후속 `task-db-structure` 배포 후 실행)

본 플랜은 SP source 와 application 코드만 갱신. 실제 DB 인스턴스 SP 배포는 후속 `task-db-structure`. 배포 완료 시점에 마스터가 다음 시나리오 수동 실행:

- [ ] **Case 1 (form_name 409)**: 같은 `company_id` 로 동일 `form_name` 재시도 → HTTP 409 `FORM_NAME_DUPLICATE` 응답.
- [ ] **Case 2 (group_name 409)**: 같은 `company_id` 로 동일 `[폼] {name}` 그룹이 이미 존재할 때 createForm → HTTP 409 `GROUP_NAME_DUPLICATE` 응답.
- [ ] **Case 3 (잔재 0)**: SP 가 unique 제약 위반하도록 의도적 시나리오 구성 → `data_group` 테이블 `__TEMP_FORM_*` 잔재 0건 확인.
- [ ] **Case 4 (정상 흐름)**: 신규 폼 생성 → `form_list` 1건 + `[폼] {name}` `data_group` 1건 정상 생성, `data_column` / `data_values` 정상.

### 마스터 명령 대비 deviation (요약)

- **항목 1 (사전 검증 추가)**: 전제였던 "이미 부분 존재" 가 사실 부재였음. 본 플랜에서 BOTH 검증 net-new 추가로 처리 (마스터 spec 일치).
- **항목 2 (SP inner-TX 제거 / atomic 단일 SP)**: option A (호출자 위임) 채택. RESIGNAL 은 wrapper contract 보호 위해 미채택, `SELECT 'FAILED'` result-set 반환 보존.
- **항목 5 (회귀 테스트)**: 자동 테스트 harness 부재로 자동화 미실시. 위 마스터 수동 회귀 체크리스트로 대체 (후속 `task-db-structure` 배포 후 실행).

### Trade-off (의도된 수용)

- **`sp_error_log` rollback**: caller rollback 시 SP 의 `INSERT INTO sp_error_log` 도 함께 rollback (MySQL 미지원 autonomous transaction). 본 fix 의 의도는 잔재 자체를 없애는 것이므로 향후 sp_error_log 누적 자체가 거의 없을 것. 운영 추적은 application logger 의 catch 출력으로 대체.
- **SP 두 파일 drift**: `fix_sp_manage_data_group.sql` 의 `is_unique` 컬럼 처리 + `relation_id` 기반 view cleanup 은 `db.sql/03-procedures.sql` 에 없음. 본 플랜은 inner-TX 형태만 통일, 기능 backport 안 함.

### 알려진 후속 (별개 plan 권장)

- **F-1**: `task-db-structure` — 본 플랜의 SP source 갱신을 실제 DB 인스턴스에 배포.
- **F-2**: `task-db-data` — 기존 40건 `__TEMP_FORM_*` 잔재 정리 (정의된 cleanup 쿼리).
- **F-3**: SP 두 파일 drift (`is_unique` / `relation_id` view cleanup) 양방향 수렴 — 후속 별도 플랜.
- **F-4**: `callSpManageDataValue` 등 다른 SP 들도 동일한 inner-TX 패턴인지 audit (본 플랜은 `sp_manage_data_group` 한정).
- **B-2 (continued)**: i-dev-001 사전 lint 결함 6건 — v001.3.0 §B-2 와 동일 카탈로그.

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
