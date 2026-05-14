# data-craft #12 잔류 정리 (C 트랙) — stale mock / orphan 타입 / cron 가드

## 마스터 명령
plan-enterprise #12 의 잔류 정리 3건 (C 트랙) 일괄 처리.

Phase 1 — 테스트 파일 stale cancelPayment mock 정리:
- 다음 5 파일에서 cancelPayment mock + 관련 검증 케이스 제거:
  - data-craft-server/src/services/charge.service.test.ts
  - data-craft-server/src/services/billingRenewal.test.ts (또는 유사 경로)
  - data-craft-server/src/services/billingSubscription.executeFirstPayment.test.ts
  - data-craft-server/tests/sec-srv-45-payment-orderid.test.ts
  - data-craft-server/src/services/seatChange.service.test.ts
- cancelPayment 보상 분기 검증 케이스는 logger.critical (event_type='PAYMENT_CHARGE_DB_FAILURE') 검증으로 교체 또는 단순 삭제
- pnpm test 로 5 파일 실행 시 PASS 확인

Phase 2 — charge.types.ts orphan 필드 정리:
- data-craft-server/src/types/charge.types.ts 의 ChargeResult orderid-mismatch variant 에서 cancelError?: Error optional 필드 + 관련 JSDoc (49-51행 근처) 제거
- 참조 grep 후 0건 확인

Phase 3 — clientSeatChangeRequests cron 가드 적용:
- next-cycle 좌석 변경 예약 처리 cron 파일 위치: grep -rn "clientSeatChangeRequests\|seatChangeRequest" src/services/ src/cron/ 으로 식별
- 처리 시점에 newSeats 산출 직후 assertValidSeats(newSeats, 1, MAX_SEATS_PER_PLAN) 추가 (Phase 1 가드와 동일 패턴)

검증 기준: 각 페이즈 후 pnpm lint exit 0. Phase 1 후 pnpm test 5 파일 PASS.

## 입력 명확화
- **Phase 3 타겟 재해석**: master 는 "cron 파일 위치 식별" 을 명시했으나 `src/cron/` 디렉토리는 존재하지 않음. 실제 next-cycle 좌석 변경 예약 처리 경로는 `src/services/billingRenewal.service.ts:renewSingleClient()` 내부 흐름 (line 150–162). 동일 의도의 단일 타겟으로 진행.

## 조사자료
- 프로덕션 코드의 `cancelPayment` 참조 0건 확인 (`grep -rn cancelPayment src/services/ src/types/ src/utils/` 결과 비어있음). 보상 분기는 `logger.critical({event_type:'PAYMENT_CHARGE_DB_FAILURE', context:'...'})` 로 치환됨 (charge.service.ts:78,132 / billingRenewal.service.ts:177,359 / billingSubscription.service.ts:252 / seatChange.service.ts:161 / promotion.service.ts:261).
- 5개 테스트 파일에 stale mock 잔존: charge.service.test.ts:19 mock + 81/130/149/152-154/158/164/170 단언, billingRenewal.test.ts:30 + 95/140/148, billingSubscription.executeFirstPayment.test.ts:30 + 105/140/149/202, src/tests/zone-01/sec-srv-45-payment-orderid.test.ts:15 + 65/70/78/84, seatChange.service.test.ts:13 mock 셋업만.
- charge.types.ts:56 `cancelError?: Error` + line 51 JSDoc 멘션 잔존. 참조: 같은 파일 56/51 + charge.service.test.ts:149/158/170. 프로덕션 0.
- assertValidSeats 정의: `src/utils/paymentGuards.ts:20-24`. `MAX_SEATS_PER_PLAN = 1000` 동일 모듈 line 4 export. 기존 호출 패턴: `billingSubscription.service.ts:126-128` (post-Math.max clamp).
- 좌석 변경 next-cycle 적용: `billingRenewal.service.ts:renewSingleClient()` line 150-162. line 153 `sumPendingDeltaForApply`, line 155 `appliedSeats = Math.max(currentSeats + netDelta, 1)`, line 156 `updateClientSeatsWithConnection`.

## 계획 개요
> 이슈 호스트 (leader repo): funshare-inc/data-craft · Work repo(s): data-craft-server
- 목표: plan-enterprise #12 잔류 정리 3건 (테스트 mock / orphan 타입 / 좌석 가드) 일괄 처리.
- 페이즈 수: 3
- 영향 파일 추정: 7
- 위험 / 미해결:
  - (낮음) Phase 1 의 "교체 vs 삭제" 정책을 phase-executor 가 케이스별로 정확히 적용해야 함 — 정책 명문화 + 5파일 PASS gate 로 회귀 방지.
  - (의미론, master 인지) Phase 3 가드 위치는 `Math.max(..., 1)` 후이므로 하한 (`< 1`) 은 silent clamp, 가드는 상한만 보호. 마스터 명시 ("Phase 1 가드와 동일 패턴") 에 따라 그대로 적용.

## 페이즈 분할

### Phase 1: 테스트 stale cancelPayment mock + cancelError 단언 제거
- 유형: test
- 설명: 5개 테스트 파일에서 `cancelPayment` 만 prune (jest.mock 블록은 다른 export mocking 중이므로 블록 자체 보존, `cancelPayment` 프로퍼티/단언만 제거). 단언 처리 정책:
  - **교체 (logger.critical spy 단언으로 1:1 매핑)**: 보상 시도/실패 부수효과 검증 케이스 — 프로덕션 호출 (`event_type:'PAYMENT_CHARGE_DB_FAILURE'` + 동일 `context` 문자열) 로 매핑.
  - **단순 삭제**: 호출 무발생 / `cancelError` undefined 검증만 하던 케이스 — 단언 라인 삭제 (케이스가 cancel 검증 전용이면 case 전체 삭제).
  - JSDoc/주석 멘션도 같이 정리.
- 영향 파일:
  - src/services/charge.service.test.ts
  - src/services/billingRenewal.test.ts
  - src/services/billingSubscription.executeFirstPayment.test.ts
  - src/tests/zone-01/sec-srv-45-payment-orderid.test.ts
  - src/services/seatChange.service.test.ts
- Phase 1 work repo: data-craft-server
- Phase 1 WIP: data-craft-server:plan-enterprise-14-polished-lake-작업

### Phase 2: charge.types.ts orphan cancelError 필드 제거
- 유형: refactor
- 설명: `ChargeResult` orderid-mismatch variant 의 `cancelError?: Error` 필드 (line 56) 제거. JSDoc (line 51) 의 "cancelKey/cancelError 반환" 문구를 "paymentKey 반환" 로 정정. Phase 1 선행으로 테스트 측 참조 0 보장.
- 영향 파일:
  - src/types/charge.types.ts
- Phase 2 work repo: data-craft-server
- Phase 2 WIP: data-craft-server:plan-enterprise-14-polished-lake-작업

### Phase 3: billingRenewal appliedSeats 가드 적용
- 유형: fix
- 설명: `billingRenewal.service.ts:renewSingleClient()` 의 next-cycle 좌석 변경 적용 흐름 (line 150-162) 에서 line 155 `appliedSeats = Math.max(currentSeats + netDelta, 1)` 직후, line 156 `updateClientSeatsWithConnection` 호출 직전에 `assertValidSeats(appliedSeats, 1, MAX_SEATS_PER_PLAN)` 추가. import 보강 필요 시 `@/utils/paymentGuards` 에서 `assertValidSeats, MAX_SEATS_PER_PLAN` 추가. 기존 `billingSubscription.service.ts:128` 호출 패턴 동일.
- 영향 파일:
  - src/services/billingRenewal.service.ts
- Phase 3 work repo: data-craft-server
- Phase 3 WIP: data-craft-server:plan-enterprise-14-polished-lake-작업

## advisor 계획 검증
- Intent: PASS — 5파일 mock 제거 + orphan 타입 제거 + 가드 적용 모두 master 명령에 1:1 매핑.
- Logic: PASS — Phase 1→2 의존성 명시 (cancelError 참조 0 보장), Phase 3 독립.
- Group Policy: PASS — data-craft-server lint_command (`pnpm lint`) 와 단일 work repo 정책 준수.
- Evidence: PASS — 프로덕션 cancelPayment 0건 + 5개 테스트 파일 line 번호 + types 잔존 필드 line 번호 + cron 부재 실측 + assertValidSeats 정의 위치 모두 grep/read 로 확인.
- Command Fulfillment: PASS — 3 페이즈로 master 명령 완결. Phase 3 가드 위치 의미론 한계는 master 명시 정책에 따라 채택.
