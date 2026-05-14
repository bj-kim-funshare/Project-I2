# data-craft 결제 도메인 결함 — 32건 통합 정리

> 작성: 2026-05-13
> 통합 대상:
> - 사전 조사 보고서 `/Users/starbox/.claude/plans/data-craft-cryptic-cookie.md`
> - 보안 점검 보고서 `/Users/starbox/.claude/plans/data-craft-payment-security-review.md` (이슈 `funshare-inc/data-craft-server#7`)
> - 비보안 점검 보고서 `/Users/starbox/.claude/plans/data-craft-payment-bug-review.md` (이슈 `funshare-inc/data-craft#11`)

## 이 문서의 사용법

- **🔴 HIGH 7건**: 사용자 돈/데이터에 즉시 영향 → 다음 patch 사이클에 우선 반영
- **🟡 MED 17건**: 발생 조건이 좁거나 영향 범위가 한정적 → 중기 백로그
- **🟢 LOW 8건**: 이미 차단 메커니즘 존재 → 회귀 가드(테스트 커버리지) 대상

각 항목은 동일 포맷으로 구성:
- 🎯 **무엇이 문제인가** (한 줄)
- 💥 **언제 터지나** (시나리오)
- 📍 **위치** (file:line)
- 🛠 **어떻게 막나** (권장 대응)

---

# 🔴 HIGH 7건 — 즉시 조치

## 1. G1 — 돈은 빠졌는데 구독은 미활성화 (보상 실패의 3중 실패)

🎯 토스 결제는 성공했는데 우리 DB 저장이 실패하면 보상으로 토스 환불을 호출하는데, 그 환불 호출까지 실패하면 로그만 남고 끝.

💥 사용자 A가 업그레이드 결제 →`charge()` 토스 OK → DB commit 직전 커넥션 끊김 → `cancelPayment()` 시도 → 토스 5xx → 그대로 종료. 사용자는 카드값만 빠지고 서비스는 그대로.

📍 동일 패턴이 4곳에 존재:
- `data-craft-server/src/services/billingSubscription.service.ts:247-265` (첫결제)
- `data-craft-server/src/services/billingRenewal.service.ts:179-205` (갱신)
- `data-craft-server/src/services/seatChange.service.ts:158-165` (좌석 즉시추가)
- `data-craft-server/src/services/promotion.service.ts:266` (프로모션)

🛠 단일 retry/DLQ 레이어를 만들어 4곳이 공유:
- 보상 cancel 실패 시 재시도 큐에 적재
- alert 발동 (관리자 즉시 통보)
- 일별 reconciliation 잡으로 토스 결제 ↔ DB 상태 자동 대조

---

## 2. G2 — 좌석 추가 시 "이 금액으로 결제하시겠습니까?" 화면이 없음

🎯 좌석 추가 다이얼로그에서 "즉시 결제" 토글한 뒤 버튼 한 번 누르면 토스 결제창 없이 백엔드가 곧장 카드 청구.

💥 관리자가 인원수 잘못 입력 후 즉시결제 클릭 → 의도와 다른 금액 청구 → 환불 정책상 환불 안 됨 → 클레임.

📍 `data-craft/src/features/subscription/ui/SeatAddDialog.tsx:102-134, 310-320`

🛠 두 가지 옵션:
- (권장) 2-step confirm 모달 추가 ("실제 청구 금액 N원 — 확인" 버튼)
- 또는 토스 결제창을 띄워 사용자 손으로 승인 받기 (UX 무거워짐)

---

## 3. G3 + B3 + B4 — `seats` / `amount` 상한 무검증 (금액 조작 가능)

🎯 FE 가 보낸 `seats` 값에 상한선이 없어서 악의적 사용자가 999999 같은 값을 보내면 그대로 청구됨.

💥 침해된 FE 코드 또는 직접 API 호출로 `seats=99999` 전송 → 카드 한도까지 청구 → 사용자 클레임 + 환불 부담.

📍 같은 패턴이 3경로:
- `data-craft-server/src/services/promotion.service.ts:169-176` (프로모션 구매)
- `data-craft-server/src/services/seatChange.service.ts` (좌석 즉시추가)
- `data-craft-server/src/services/billingSubscription.service.ts` (executeFirstPayment)

또한 `amount` 가 `NaN` / `Infinity` 인 경우도 차단 안 됨 (`charge.service.ts:74-97`).

🛠
- `promotion` 테이블에 `max_seats` 컬럼 추가
- 모든 결제 경로에 공통 `assertValidAmount(amount)` 가드 (정수 + 0 < amount ≤ 합리적 상한)
- `seats` 도 `Number.isInteger(seats) && seats >= min && seats <= max` 강제

---

## 4. G4 — 토스 웹훅 HMAC 서명 검증 부재

🎯 웹훅이 `secret` 문자열만 평문 비교 → 토스 표준 위반. 공격자가 `secret` 만 알면 임의 페이로드 위조 가능.

💥 공격자가 `PAYMENT_STATUS_CHANGED` 위조 → 결제 상태를 `FAILED` 로 강제 → 사용자 강등 / `BILLING_DELETED` 위조 → 자동 갱신 차단.

📍 `data-craft-server/src/controllers/webhook.controller.ts:34-42`

🛠 토스 공식 정책에 secret 필드 / HMAC 헤더가 없는 것으로 확인됨 (보안 점검 결과). 대안:
- IP allowlist (토스 발신 IP 만 허용)
- `paymentKey` 로 토스에 재조회 후 상태 확인 (pull-after-push 패턴)

---

## 5. B1 — billingKey / 카드번호 평문 INSERT

🎯 billingKey 와 카드번호 일부가 암호화 없이 DB 에 그대로 저장됨.

💥 DB 덤프 유출 또는 SQL injection 1건만으로 모든 사용자 billingKey 노출 → 토스가 발급한 키 자체로 청구 가능한 토큰 → 대규모 사고.

📍 `data-craft-server/src/models/billing.model.ts:50-55`

🛠 KMS / `crypto.createCipheriv` 기반 봉투암호화. 마이그레이션:
- 신규 행은 즉시 암호화 저장
- 기존 행은 배치로 백필 → 검증 후 평문 컬럼 drop

---

## 6. B2 — `cancelPayment` 내부 `companyId` 가드 부재 (IDOR)

🎯 `cancelPayment` 함수가 호출자의 `companyId` 와 결제건의 `companyId` 일치 검증 없이 동작.

💥 환불 API 가 외부에 노출되거나 권한 우회되면 사용자 A 의 토큰으로 사용자 B 의 결제를 환불 호출 가능 → 자금 이동 / 분쟁.

📍 보안 점검 보고서의 B2 항목 (`tossPayments.service.ts` 의 `cancelPayment` 호출지점들).

🛠 함수 시그니처에 `requestingCompanyId` 강제 + 결제건 조회 후 일치 검증. 미들웨어 가드는 우회 가능하므로 함수 레벨 가드 필수.

---

## 7. G8 — 협업 프로모션 결제 직전 정원 race

🎯 결제 직전에 `findClientSeats()` 로 현재 정원을 읽는데, 그 사이 admin 이 정원 바꾸면 FE 가 표시한 금액과 실제 청구액이 달라짐.

💥 사용자가 5인 기준 견적 보고 결제 진행 → 결제 도착 직전 admin 이 10인으로 변경 → 2배 청구.

📍 `data-craft-server/src/services/billingRenewal.service.ts:277-285`

🛠 결제 직전에 `seats` 값을 `SELECT ... FOR UPDATE` 로 잠그고 트랜잭션 안에서 charge 호출 직전까지 유지. 또는 견적 시점에 amount snapshot 을 만들어 결제까지 가져감.

---

# 🟡 MEDIUM 17건 — 중기 백로그

## 8. G5 — 회수된 프로모션이 영원히 재시도 (무한 실패 루프)

💥 admin 이 프로모션 비활성화 → cron 이 `pending_promotion_id` 보고 `purchasePromotion()` 재시도 → `isWithinDisplayWindow` 실패 → pending_id 정리 안 됨 → 다음 cron 도 동일.
📍 `data-craft-server/src/services/billingRenewal.service.ts:46-61`
🛠 실패 카운트 N회 도달 시 `pending_promotion_id` 자동 클리어 + alert.

## 9. G6 — 프로모션 회수 후 사용자가 사실상 무료로 계속 사용

💥 `findPromotionById()` → NULL → return false (그 달 결제 스킵 + 강등도 없음) → 사용자는 FREE 한도로 계속 이용.
📍 `data-craft-server/src/services/billingRenewal.service.ts` + `subscription.service.ts:40-56`
🛠 NULL 분기에서 명시적으로 강등 경로(정가 전환 또는 free 전환) 처리.

## 10. G7 + B:js-date-overflow — 윤년/말일 갱신 지연

💥 2024-02-29 가입자가 연간 갱신 시 `setFullYear(+1)` → 2025-02-29 부재 → 3월 1일로 한 달 밀림. 월간은 보정 있는데 연간은 없음.
📍 `data-craft-server/src/services/billingSubscription.service.ts:65-72` + `billingRenewal.service.ts:100-113`
🛠 연간 갱신에도 말일 보정 추가. 공용 `addPeriodPreservingEndOfMonth()` 유틸 도입.

## 11. G9 — 토스 웹훅 이벤트 순서 역전

💥 `BILLING_DELETED` 가 `PAYMENT_STATUS_CHANGED` 보다 먼저 도착하면 빌링키부터 비활성 → 후속 결제 처리 꼬임.
📍 `data-craft-server/src/controllers/webhook.controller.ts:58-85`
🛠 각 이벤트 처리 전에 토스 API 로 최신 상태 재조회 (pull). G4 의 pull-after-push 와 동일 솔루션.

## 12. G10 — 프로모션 만료 boundary timezone

💥 SQL `NOW()` (서버 timezone) 와 JS `Date.now()` (UTC) 이중화 → 만료 9시간 구간에서 한쪽 통과 / 한쪽 거부.
📍 `data-craft-server/src/models/promotion.model.ts:71, 309-312`
🛠 만료 비교를 SQL `NOW()` 단일 경로로 통일. JS 비교 제거.

## 13. G11 — 프로모션 취소해도 `payment_history.promotion_id` 그대로

💥 `unpaid_business_once` 프로모션을 취소했는데 `payment_history` 의 promotion_id 가 그대로 남아 재구매 차단 → "취소했는데 왜 못 사느냐" 클레임.
📍 `data-craft-server/src/services/promotion.service.ts:347-382`
🛠 `cancelPromotion()` 에서 `payment_history.promotion_id` 를 NULL 처리하거나, 재사용 검증 시 status='cancelled' 결제는 제외하는 쿼리.

## 14. G12 — 환불 정책 약관 명문화 미확인

💥 코드는 "프로모션 취소 시 환불 없음" 으로 의도적 구현인데, 약관에 명시 안 됐다면 분쟁 시 패소 위험.
📍 정책 / 약관 문서 (코드 외)
🛠 약관에 "프로모션 적용 결제는 취소 시 환불 없음, 잔여 기간만 소진" 명문화.

## 15. B5 — `getPaymentHistoryController` owner 가드 누락

💥 결제 이력(재무 PII) 조회 API 에서 호출자 = 소유자 검증 미흡 → 권한 우회 시 타사 결제 내역 조회 가능.
📍 보안 보고서 B5
🛠 컨트롤러 진입부에서 `req.user.companyId === ph.companyId` 강제.

## 16. B6 — 웹훅 secret 비교의 timing channel

💥 `event.secret !== TOSS.WEBHOOK_SECRET` 평문 비교는 string 길이별 응답시간이 달라 secret 추측 가능 (이론적 공격).
📍 `webhook.controller.ts:38-42`
🛠 `crypto.timingSafeEqual()` 로 교체. G4 와 함께 처리.

## 17. B7 — orderId 가 `Math.random()` PRNG → 충돌 가능

💥 orderId 가 `Date.now()+random6` 인데 `Math.random()` 은 암호학적 PRNG 아님. 동시 결제 폭주 시 충돌 → SEC-SRV-45 (orderId 불일치 시 자동 취소) 가 작동해 정상 결제까지 거부될 위험.
📍 `data-craft-server/src/services/billingRenewal.service.ts:116-118` 외 3곳
🛠 `crypto.randomUUID()` 또는 `crypto.randomBytes(8).toString('hex')` 로 교체.

## 18. B8 — `TOSS_*_SECRET` env 변수 fail-fast 부재

💥 env 누락 상태로 서버 부팅 가능 → 첫 결제 시도 시점에서 비로소 실패 → 디버깅 어려움 + 사용자 노출.
📍 보안 보고서 B8
🛠 부팅 시 `assertEnv(['TOSS_SECRET_KEY', 'TOSS_WEBHOOK_SECRET', ...])` 호출, 미설정 시 즉시 종료.

## 19. B:swallow-promotion-charge — `renewPromotionClient` 1회 즉시 grace

💥 프로모션 갱신 실패를 1회 그냥 grace 처리 → 실제로는 결제 실패인데 사용자는 계속 이용 → 수익 손실.
📍 `data-craft-server/src/services/billingRenewal.service.ts:284-308`
🛠 grace 카운트를 DB 컬럼으로 기록 + 임계 도달 시 강등.

## 20. B:rollbackActivation-swallow — Phase B 롤백 실패 swallow

💥 프로모션 활성화 Phase A commit 후 Phase B charge 실패 시 rollback 호출 → 그 rollback 도 실패하면 `logger.error` 만. `client.active_promotion_id` 가 좀비 상태로 남음.
📍 `data-craft-server/src/services/promotion.service.ts:205-235`
🛠 G1 DLQ 레이어 공유. 좀비 상태 detection 잡 추가.

## 21. B:schedulePromotion-seats — `seats` 미snapshot → 무한 실패 루프

💥 프로모션 예약 시 `seats` 를 snapshot 안 함 → 갱신 시점에 `seats` 가 minUsers 미만이면 실패 → pending 정리 안 되어 무한 실패.
📍 `data-craft-server/src/services/promotion.service.ts:314-342`
🛠 예약 시 `effectiveSeats` 를 `client_promotion` 행에 snapshot. 갱신 시 그 값 사용.

## 22. REVISIT:G10-cron-race — 만료 boundary 가 cron 호출 시점과 어긋남

💥 G10 의 비보안 측 자매. 프로모션 만료 직전에 cron 이 도는 race.
📍 `charge.service.ts` / `promotion.model.ts:309-312`
🛠 G10 SQL 단일화로 동시 해결.

## 23. REVISIT:B3-overflow — `amount` NaN/Infinity 미차단

💥 G3 의 비보안 측 자매. amount 가 NaN 이면 토스 API 가 어떻게 반응할지 불명.
📍 `charge.service.ts:74-97`
🛠 `assertValidAmount` 가드 (G3 와 함께).

## 24. REVISIT:B7-collision — orderId 충돌이 SEC-SRV-45 차단을 깨뜨림

💥 B7 의 비보안 측 자매. orderId 충돌 시 정상 결제가 SEC-SRV-45 차단에 걸려 거부.
📍 `billingRenewal.service.ts:116-118`
🛠 B7 PRNG 교체로 동시 해결.

---

# 🟢 LOW 8건 — 차단 메커니즘 존재 (회귀 가드)

이미 코드상 막혀있지만 향후 리팩토링 시 차단이 깨질 수 있으므로 **테스트 케이스 보유 여부 점검 권장**.

| ID | 시나리오 | 현재 차단 메커니즘 |
|---|---|---|
| G13 | orderId 충돌로 정기 갱신 이중결제 | 루프마다 신규 orderId 생성 + SEC-SRV-45 자동 취소 |
| G14 | 플랜 변경 + 프로모션 동시 진행 | `assertNoActivePromotion()` 양방향 차단 |
| G15 | 좌석 변경 + 다운그레이드 예약 동시 | 양방향 사전 차단 |
| G16 | 좌석 정원 초과 멤버 승인 race | `SELECT ... FOR UPDATE` + 트랜잭션 내 카운트 |
| G17 | 결제 주기 변경 중 즉시 좌석 결제 | `SEAT_CHANGE_IMMEDIATE_BLOCKED_CYCLE_PENDING` 사전 차단 |
| G18 | 탭 간 세션 혼동으로 중복 결제 | sessionStorage 세마포어 |
| G19 | Pending payment 30분 stale | TTL + 자동 cleanup |
| G20 | 좌석 0명 도달 | `SEAT_MIN_ONE` 강제 |

🛠 각 항목에 대응하는 통합 테스트 1개씩 확보 → 회귀 가드.

---

# 한눈 요약 — 우선순위 매트릭스

| 우선순위 | 건수 | 핵심 메시지 |
|---|---|---|
| 🔴 HIGH | 7 | 사용자 돈/데이터 직접 영향. 다음 patch 사이클 필수 |
| 🟡 MED | 17 | 발생 조건 좁음. 중기 백로그 |
| 🟢 LOW | 8 | 차단됨. 테스트 커버 추가만 |
| **합계** | **32** | |

## 권장 진행 순서

1. **Phase 1 — HIGH 정합성** (1주): G1, G8, B:schedulePromotion-seats, REVISIT:B3
2. **Phase 2 — HIGH 보안** (1주): B1, B2, G4, G3+B3+B4
3. **Phase 3 — HIGH UX** (3일): G2
4. **Phase 4 — MED 정합성/보안** (2주): G5, G6, G7+B:js-date-overflow, G9, G10, G11, B5, B6, B7, B8, B:swallow-promotion-charge, B:rollbackActivation-swallow
5. **Phase 5 — LOW 회귀 가드** (1주): G13~G20 테스트
6. **Phase 6 — 정책 문서** (병행): G12 약관

추정 총 작업량: ~5주 (1인 풀타임 기준, 검토/머지 포함)
