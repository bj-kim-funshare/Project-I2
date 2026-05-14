## Phase 3 완료 — `b8f7673`

`billingRenewal.service.ts:renewSingleClient()` 의 next-cycle 좌석 적용 흐름에서 `appliedSeats = Math.max(currentSeats + netDelta, 1)` 직후 + `updateClientSeatsWithConnection` 호출 직전에 `assertValidSeats(appliedSeats, 1, MAX_SEATS_PER_PLAN)` 1줄 삽입. `@/utils/paymentGuards` 에서 두 심볼 import 추가. `billingSubscription.service.ts:126-128` 와 동일 패턴.

Phase 3 WIP: data-craft-server:plan-enterprise-14-polished-lake-작업

| 항목 | 값 |
|------|-----|
| 커밋 | b8f7673 |
| Work repo | data-craft-server |
| 변경 | +2 / -0 across 1 file (import 1줄 + 가드 1줄) |
| Lint | PASS (exit 0, 경고 1건) |
| Blockers | 0 |
