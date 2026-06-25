# Roadmap 17: data-craft 관리자 플랜·혜택 호환성 결함 수정

> 작성일: 2026-06-25 (R1a 완료 갱신) | 대상: data-craft 관리자 콘솔(기업 플랜 관리 + 혜택 관리) 직접변경의 실사용 호환성 결함 14건 수정 (E1=DDL nullable 정합 완료, 나머지 13건 코드)

## 프롬프트

🟢 /task-db-structure data-craft [R1a·CRITICAL·완료] E1 — referral_credit.source_payment_id nullable 정합(admin 20260619 nullable 의도 확정, server 20260621 SET NOT NULL supersede). 마이그레이션 20260625, dev·prod 적용 완료(머지 30370b3, advisor PASS, 비파괴·행수0). grantCredit 코드 무변경 — source_payment_id=NULL INSERT 정상화. ※원 감사가 admin 20260619 nullable 마이그레이션을 놓쳐 "합성 payment 행·스키마 무변경" 전제가 틀렸고, 실제 수정은 DDL nullable 정합이었다(라이브 dev·prod 실측 확정).

🟢 /plan-enterprise data-craft [R1b·CRITICAL·완료] E3 — 평생 3개월 추천 적립 캡 우회 차단. adminReferral.adjustMonths 에 no-lowering 가드(FOR UPDATE 현재값보다 낮은 SET 거부) 추가 → granted_months monotonic → adjustMonths(0) 리셋 재적립 우회 봉쇄(Option A 코드-only, 스키마 무변경). 이슈 #465, commit 00ae5905, patch-note v001.1110.0, advisor 계획·완료 PASS. **E1(task-db-structure)과 함께 R1 두 CRITICAL 완결.**

🟢 /plan-enterprise data-craft [R2·완료] 할인쿠폰 결함 3건 — (D4) reserveCouponWithConnection에 code.deleted 가드(soft-delete 발급분 누수 차단, server). (D1) createCoupon+updateCoupon 빈-target 검증 COUPON_TARGETS_REQUIRED(영구사용불가 차단, admin). (D2) updateCoupon registered-wallet 보유 시 경제·적용 6필드 소급 변경 차단 COUPON_HAS_ACTIVE_WALLETS(block 정책, used 제외, admin). 코드-only, 이슈 #468, patch-note v001.1113.0, advisor 양 PASS. ※알려진 한계: 유리한 변경도 차단(비활성화+재생성 워크플로우).

🟢 /plan-enterprise data-craft [R3·완료] 기업 플랜 직접변경 결함 — (A-COMBO) updateCompany `(b)` 자동 만료/anchor 정합 블록에 `&& input.planExpiresAt === undefined` 가드 추가 → planType(유료)+planExpiresAt 동시전송·현재 sentinel/past 시 `plan_expires_at`/`billing_anchor_day` 중복 SET(PG 42601) 하드실패 제거(명시값 우선). (A1a) 카드(active billing_info) 없는 유료부여 `NO_BILLING_METHOD` 차단(silent free 강등 방지). (A3) enterprise 유한 실날짜 만료 `ENTERPRISE_EXPIRY_FORBIDDEN` 차단(sentinel 유지·계약종료는 plan_type 경로). (유료+null 만료) `PAID_PLAN_REQUIRES_EXPIRY` 차단. data-craft-admin-server 단일파일 adminCompanies.service.ts, 코드-only, 2페이즈(c1560f1·d00fb4c, 머지 ca5534b), 이슈 #472, patch-note v001.1118.0, advisor 계획·완료 양 PASS. ※ground-truth 재판정으로 범위축소: A2 무수정(갱신이 charge·연장 둘 다 billing_cycle 계산→총액 과청구 없음, 의도된 오버라이드)·A1b/A2b 코드무변경(기존 writeClientAuditDev가 before/after 전체행 기록으로 이미 충족)·A4c 드롭(client_seat_change_requests에 cycle 필드 없음·billingSubscription이 pending_billing_cycle 의도적 보존=이미 닫은 버그, 좌석변경 시 정리는 회귀)·A3후반(미래만료→큐 크레딧) note-and-defer(능동 소멸 아님).

🟢 /plan-enterprise data-craft [R4·완료] 프로모션 카탈로그·해제 결함 3건 — (C2) updatePromotion이 활성 client_promotion(status='active') 보유 시 is_collaboration/min_users/max_seats(갱신 `renewPromotionClient` LIVE read·스냅샷 컬럼 없음) 변경 `PROMOTION_HAS_ACTIVE_ASSIGNMENTS` 차단(타입정규화 Boolean/Number, 정확히 3필드만 — max_seats 하향→기존 snapshotSeats 초과→assertValidSeats throw→갱신실패→free 강등 방지). (B2a) removePromotion에 pending `client_seat_change_requests` DELETE 추가(server `expireClientPromotionInTx`:367-370 정합 — 고아 좌석 델타가 이후 per-user 유료 복원 시 다음 갱신 합산 오청구되던 것 차단). (C1) create+update `min_users<=max_seats` `INVALID_PROMOTION_SEATS_RANGE` 검증. data-craft-admin-server 2파일(adminPromotion.service.ts·adminCompanies.service.ts), 코드-only, 2페이즈(3ceff4f·89cf9d1, 머지 c692d16), 이슈 #473, patch-note v001.1120.0, advisor 계획·완료 양 PASS. ※C2 방향=차단 확정(is_collaboration/max_seats snapshot 컬럼 부재+갱신 LIVE-read라 snapshot 동기화 비viable, R2 D2 선례). 한계: 유리한 변경도 활성배정 중 차단(비활성+재생성 워크플로우)·complete-body 계약 의존(partial body 우회 가능, pre-existing).

🔴 /plan-enterprise data-craft [R5 추천 마무리·감사] (E5) revokeCoupon charge() 창 race·멱등 가드(할인청구+소비기록 공백 차단). (E6-tail·마스터 결정) referralEarning.service.ts:133-136 `|| benefitsRevoked`로 해지 후에도 추천인 영구 10% tail 적립 — 유지/제거 정책을 plan 단계에서 마스터 확인 후 반영. 착수 전 마스터 결정 필요.

---

## 로드맵 설명

data-craft 관리자 콘솔 "기업 플랜 관리"(플랜·주기·만료·좌석)와 "혜택 관리"(프로모션·쿠폰·크레딧) 직접 write가 실사용 결제·갱신·차감 파이프라인과 호환되지 않는 결함 14건을 코드로 수정한다. 근거: 2026-06-24~25 전수 정밀분석 + 다중에이전트 적대적 검증(reachability·guard 2렌즈) + cross-op 조합분석(plan-timing·catalog-blast·referral-billing). 전 산출물(보고서·불변식 6종·cross-op 3종·평결·journal-recovered)은 `~/Documents/data-craft-admin-호환성-감사-20260625/` 에 durable 보관.

**버킷 (불확정 0)**: 진짜 결함 14 — CRITICAL 2(E1 추천크레딧 NOT NULL 전량실패·E3 캡 우회 무한적립) / 높음 6(A2 주기 과청구·A3 enterprise 만료 강등·A1a 카드무 강등·C2 프로모션 LIVE 소급·D4 쿠폰 soft-delete 무력·D2 쿠폰 수정 소급) / 중간 6(A-COMBO 결합편집 42601·B2a 해제 고아 좌석큐·D1 빈 target 쿠폰·E5 revokeCoupon race·A4c cycle 예약 고아·C1 min<=max 미검증). 정책 오버라이드(결함 아님, 수정 제외)=A1b·A2b(통지만 R3 보완)·A4a·A4b·B1a·D3·E2·E6-비대칭. 안전(이슈 없음)=E4·C2b·C3·ENT·FK·plan-limit 다운그레이드(기존 데이터 보존)·감사트리거(roadmap7 decouple).

**핵심 결정**:
1. E1은 nullable 정합(task-db-structure, **완료**) — 원 감사가 admin `20260619` nullable 마이그레이션을 놓쳐 "합성 payment 행·스키마 무변경" 전제가 틀렸음을 라이브 확인(dev·prod NOT NULL·행수0)으로 정정. 나머지 13건(E3 포함)은 코드 수정. **거버넌스 부채**: server `20260621` SET NOT NULL 파일이 트리에 잔존(admin DB/migrations 와 별도 마이그레이션 트랙) — 향후 정리/통합 순서 관리 필요.
2. 주력 수정 repo = data-craft-admin-server, 일부 가드는 data-craft-server(쿠폰 reserve·추천 적립/tail·스케줄러).
3. 5단계는 같은 data-craft i-dev 통합브랜치 공유 + 파일 중복(R1·R5=referralEarning, R3·R4=빌링/프로모션 read, R2=couponDeduction) → 병렬 금지·순차 실행(WIP 충돌 회피).
4. R5의 E6-tail은 코드 결함이 아닌 제품 정책 결정 — 착수 전 마스터 확정 필요.

**실행**: 각 R 단계를 master가 `/plan-enterprise data-craft` 로 위→아래 순서대로 1건씩 실행. R1(CRITICAL) 우선. 본 로드맵은 프롬프트 작성만 — 실행은 master 주도.
