## Phase 1 완료 — `9c8606b`

5개 테스트 파일에서 cancelPayment mock 프로퍼티를 제거하고 logger mock에 critical: vi.fn() 을 추가하여 TypeError 를 해소. 보상 취소 시도/실패 부수효과를 검증하던 케이스는 logger.critical spy 단언 (`event_type:'PAYMENT_CHARGE_DB_FAILURE'` + 매핑된 `context` 문자열) 으로 교체, cancelError 전파 검증 전용이던 케이스는 전체 삭제. sec-srv-45 시뮬레이션 테스트의 cancelPayment 직접 호출 시뮬레이션도 단순 불일치 검출 단언으로 대체.

Phase 1 WIP: data-craft-server:plan-enterprise-14-polished-lake-작업

| 항목 | 값 |
|------|-----|
| 커밋 | 9c8606b |
| Work repo | data-craft-server |
| 변경 | +17 / -108 across 5 files |
| Lint | PASS (exit 0) |
| Blockers (scope-out) | 2 (사전 존재 — Phase 1 스코프 외) |

**Blockers (사전 존재, 스코프 외)**
- billingRenewal.test.ts: '3회 모두 실패 시 FAILED 이력 저장 + 알림 생성' 케이스가 Phase 1 이전부터 실패 (notification reason 문자열 불일치 — 테스트 `자동갱신 결제 3회 연속 실패` vs 프로덕션 `자동갱신 결제 3회 연속 실패 → Free 강등`).
- webhook.controller.test.ts, webhook.idempotency.test.ts, promotion.routes.*.test.ts: pre-existing 실패 (debug-chain 라우터 미존재 / billing.model.ts 경로 불일치 / webhook.model.ts 미존재).
