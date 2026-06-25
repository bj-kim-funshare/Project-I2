# Roadmap 17: data-craft 관리자 플랜·혜택 호환성 결함 수정

> 작성일: 2026-06-25 | 대상: data-craft 관리자 콘솔(기업 플랜 관리 + 혜택 관리) 직접변경의 실사용 호환성 결함 14건 코드 수정 (스키마 무변경)

## 프롬프트

🔴 /plan-enterprise data-craft [R1·CRITICAL 추천/크레딧] 관리자 추천 크레딧 결함 2건. 분석 보고서 ~/Documents/data-craft-admin-호환성-감사-20260625/REPORT-관리자-플랜-혜택-호환성.md 참조. (E1) adminReferral.service.ts grantCredit가 source_payment_id=NULL로 INSERT해 NOT NULL+FK(payment_history.id) 위반 전량실패 — admin-grant 전용 payment_history 행 합성(amount=0, source='admin-grant' 등)해 FK 충족(스키마 무변경). ⚠합성 행은 accrueReferralCredits 적립·매출/결제이력 집계에서 반드시 제외(미제외 시 CRITICAL→데이터오염 전환). (E3) 평생 3개월 캡이 가변 카운터 referral_relation.*_granted_months 하나뿐(DB 상한 없음) — adjustMonths 0 리셋 후 무한 재적립 차단: 발급 referral_credit 원장 기반 캡 또는 adjustMonths 하향 시 재적립 게이트.

🔴 /plan-enterprise data-craft [R2 쿠폰] 할인쿠폰 결함 3건. (D4) data-craft-server reserveCouponWithConnection·lockCouponCodeForUpdate에 coupon_code.deleted=false 검사 추가(soft-delete 무력화 차단). (D2) updateCoupon LIVE 소급(발급 wallet 즉변) 정책 결정 후 가드(활성 발급분 보유 시 경제필드 변경 차단 또는 wallet 스냅샷). (D1) createCoupon applies_all=false+target0 영구사용불가 서버검증.

🔴 /plan-enterprise data-craft [R3 플랜/빌링] 기업 플랜 직접변경 결함 5건 + 투명성 보완. (A2) 주기 직접변경 시 plan_expires_at·billing_anchor_day 재계산(과청구 차단). (A3) enterprise/sentinel 만료일 실날짜→free 강등 가드 + (A1a) 카드 없는 유료부여 차단/경고. (A-COMBO) updateCompany planType+planExpiresAt 동시전송 시 plan_expires_at SET 중복→PG 42601 제거. (A4c) seats 변경 시 pending 좌석요청 삭제와 함께 pending_billing_cycle 짝 정리. (A1b/A2b 투명성 보완) 플랜·주기 직접변경으로 사용자 예약(다운그레이드/주기) 무음 취소 시 사용자 통지/감사 강화.

🔴 /plan-enterprise data-craft [R4 프로모션] 프로모션 카탈로그·해제 결함 3건. (C2) updatePromotion이 활성 client_promotion 보유 프로모션의 is_collaboration/min_users/max_seats(갱신 LIVE read) 변경 시 가드(차단 또는 snapshot 동기화, 갱신실패→강등 방지). (B2a) removePromotion이 client_seat_change_requests pending 정리(expireClientPromotionInTx 정합). (C1) createPromotion min_users<=max_seats 검증.

🔴 /plan-enterprise data-craft [R5 추천 마무리·감사] (E5) revokeCoupon charge() 창 race·멱등 가드(할인청구+소비기록 공백 차단). (E6-tail·마스터 결정) referralEarning.service.ts:133-136 `|| benefitsRevoked`로 해지 후에도 추천인 영구 10% tail 적립 — 유지/제거 정책을 plan 단계에서 마스터 확인 후 반영. 착수 전 마스터 결정 필요.

---

## 로드맵 설명

data-craft 관리자 콘솔 "기업 플랜 관리"(플랜·주기·만료·좌석)와 "혜택 관리"(프로모션·쿠폰·크레딧) 직접 write가 실사용 결제·갱신·차감 파이프라인과 호환되지 않는 결함 14건을 코드로 수정한다. 근거: 2026-06-24~25 전수 정밀분석 + 다중에이전트 적대적 검증(reachability·guard 2렌즈) + cross-op 조합분석(plan-timing·catalog-blast·referral-billing). 전 산출물(보고서·불변식 6종·cross-op 3종·평결·journal-recovered)은 `~/Documents/data-craft-admin-호환성-감사-20260625/` 에 durable 보관.

**버킷 (불확정 0)**: 진짜 결함 14 — CRITICAL 2(E1 추천크레딧 NOT NULL 전량실패·E3 캡 우회 무한적립) / 높음 6(A2 주기 과청구·A3 enterprise 만료 강등·A1a 카드무 강등·C2 프로모션 LIVE 소급·D4 쿠폰 soft-delete 무력·D2 쿠폰 수정 소급) / 중간 6(A-COMBO 결합편집 42601·B2a 해제 고아 좌석큐·D1 빈 target 쿠폰·E5 revokeCoupon race·A4c cycle 예약 고아·C1 min<=max 미검증). 정책 오버라이드(결함 아님, 수정 제외)=A1b·A2b(통지만 R3 보완)·A4a·A4b·B1a·D3·E2·E6-비대칭. 안전(이슈 없음)=E4·C2b·C3·ENT·FK·plan-limit 다운그레이드(기존 데이터 보존)·감사트리거(roadmap7 decouple).

**핵심 결정**:
1. 전부 코드 수정 — DB 스키마 무변경. E1은 합성 payment_history 행 방식(컬럼 NOT NULL+FK 유지), 단 합성 행을 적립·매출집계에서 제외하는 가드 필수.
2. 주력 수정 repo = data-craft-admin-server, 일부 가드는 data-craft-server(쿠폰 reserve·추천 적립/tail·스케줄러).
3. 5단계는 같은 data-craft i-dev 통합브랜치 공유 + 파일 중복(R1·R5=referralEarning, R3·R4=빌링/프로모션 read, R2=couponDeduction) → 병렬 금지·순차 실행(WIP 충돌 회피).
4. R5의 E6-tail은 코드 결함이 아닌 제품 정책 결정 — 착수 전 마스터 확정 필요.

**실행**: 각 R 단계를 master가 `/plan-enterprise data-craft` 로 위→아래 순서대로 1건씩 실행. R1(CRITICAL) 우선. 본 로드맵은 프롬프트 작성만 — 실행은 master 주도.
