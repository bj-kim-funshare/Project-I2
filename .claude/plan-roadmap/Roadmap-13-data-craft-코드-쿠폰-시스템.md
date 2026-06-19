# Roadmap 13: data-craft 코드 쿠폰 시스템

> 작성일: 2026-06-18 | 대상: data-craft 코드 쿠폰(수동결제 전용 변동 할인) — DB·서비스BE·관리BE·양 FE·배포 (4 repo)

## 프롬프트

🟢 /task-db-structure data-craft — 코드 쿠폰 dev DDL(서비스+관리 동일 data-craft DB). coupon_code(discount_percent·max_discount_krw NULL허용·valid_until NULL허용·max_redemptions NULL허용·is_active·소프트삭제) + coupon_code_target(code_id·target_category enum basic|standard|premium|promo_basic|promo_standard|promo_premium|seat_add, applies_all=true=무조건) + coupon_wallet(code_id·company_id·status registered|used·used_payment_id·used_at, UNIQUE(code_id,company_id)) + admin_coupon_audit(admin_actor·action·coupon_id·before/after·changed_at, 서비스 FK 0, 트리거 없이 admin-server 자기기록). **dev psql data_craft_dev 만 적용**(prod는 후행). prod 반영용 마이그레이션·롤백 파일 동시 작성. **[완료 2026-06-18: dev psql data_craft_dev 적용·검증 통과 — 4테이블+enum 2종(coupon_target_category_enum 7값·coupon_wallet_status_enum 2값)+인덱스 5+UNIQUE(code_id,company_id). data-craft-server i-dev 머지(`docs/migration/ddl-changes/20260618150000_coupon-code-system/` up.sql+down.sql; plan.md은 .gitignore 누락). advisor PASS. ⚠️ prod 단계(⑥) 주의: admin_coupon_audit는 어드민 전용 → prod 적용 금지(메모리 admin_meta_not_in_prod), 서비스 3테이블만 prod 반영. 메모리 project_data_craft_coupon_code_system_design 갱신.]**

1️⃣ 🟢 /plan-enterprise data-craft — 코드 쿠폰 서비스 BE (data-craft-server, DDL 선행 필수). ①보관함 등록 API(존재·is_active·valid_until·미등록·소진코드 차단, 슬롯 비점유) ②"쿠폰 선택" 자격평가 API(현재 결제조건으로 보관함 쿠폰 활성/비활성 — 카테고리+만료+한도+미사용, 과금을 플랜/좌석 분해해 카테고리 결정: 플랜우선·플랜과금0+좌석과금만이면 seat_add) ③결제 확정 적용(수동결제 4경로 first-payment/upgrade/seat-change/promotion-purchase 최종액 직후 할인액=min(최종×p,캡) 곱셈, 서버 재검증, FOR UPDATE 슬롯 점유). computeDeductionPlan 무손상, auto-renewal·프로모션 스냅샷 청구 제외. pnpm build(tsc)+fresh 워크트리 pnpm install+로컬 psql 실측. **[완료 2026-06-19 (plan-enterprise #382, closed): 6 페이즈 — coupon.model/coupon.service/couponCategory.service/couponDeduction.service/coupon.types + 등록·조회·자격평가 API 3종 + 수동결제 4경로 할인 배선. 동시성=낙관적 사전 예약(coupon_code FOR UPDATE+affectedRows=1+COUNT≤max). 카테고리 서버 재계산. computeDeductionPlan·auto-renewal 무변경. data-craft-server i-dev 머지(로컬), patch-note v001.993.0. advisor 계획·완료 PASS. ⚠️ first-payment 고아 예약 sweeper 후속 권장(upgrade/promotion in-txn 안전). 추천 적립 base=할인 전 원액(독립성). 메모리 project_data_craft_coupon_code_system_design 갱신.]**

1️⃣ 🟢 /plan-enterprise data-craft — 코드 쿠폰 관리 BE (data-craft-admin-server, DDL 선행 필수). coupon_code CRUD(생성·수정·소프트삭제) via 토글 데이터 풀(서비스 DB coupon_code 거주), 각 쓰기 후 admin_coupon_audit 자기기록, verifyAdminToken+dbMode 보호. dev/prod 토글 준수. **[완료 2026-06-19 (plan-enterprise #386, closed): 2 페이즈 — adminCoupon.service(CRUD 5종+coupon_code_target replace+소프트삭제+writeAuditDev→authPool admin_coupon_audit)·controller·routes(/api/admin/coupons). promotion CRUD 미러·무변경. DB 실측 DB_NAME_AUTH==DB_NAME_DATA==data_craft_dev(audit는 authPool=dev 고정, prod 토글에도 dev — admin_meta_not_in_prod 충족). data-craft-admin-server i-dev 머지(로컬), patch-note v001.998.0. advisor 계획·완료 PASS. ⚠️ valid_until 미래 검증 미구현(만료코드 생성 가능, 등록서 즉시 거부되어 실해 없음 — FE/핫픽스 후속). 메모리 갱신.]**

2️⃣ 🔴 /plan-enterprise data-craft — 코드 쿠폰 서비스 FE (data-craft, 서비스 BE 의존). ①보관함(AccountTab ReferralInfoDialog 위치) 코드 등록 + 등록목록 조회 ②결제화면 "쿠폰 선택"(서버 자격평가→전체목록 활성/비활성, 견적 스냅샷 종속 자동취소, 할인 미리보기).

2️⃣ 🔴 /plan-enterprise data-craft — 코드 쿠폰 관리 FE (data-craft-admin, 관리 BE 의존). 쿠폰 목록·생성·수정·삭제(할인률·할인한도·유효기간·최대사용수·카테고리 OR·무조건 토글, 사용이력 있으면 소프트삭제만).

🔴 /task-db-structure data-craft — 코드 쿠폰 prod DDL. dev 검증된 동일 마이그레이션을 prod data_craft_production 적용. `분리` 정책상 dev 게이트 건너뛰고 prod 게이트만. additive·비파괴(구 prod BE 무회귀).

🔴 /patch-confirmation data-craft — 4 repo i-dev origin push(dev-merge PR base 확보 — plan-enterprise는 표준종료점에서 push 안 함).

🔴 /dev-merge data-craft — i-dev → main (4 repo: data-craft-server·data-craft-admin-server·data-craft·data-craft-admin).

🔴 /pre-deploy data-craft — 4 repo 배포(서비스 BE는 main:aws-deploy push+EC2 pull+pm2, FE는 gh-pages, 관리 콘솔 포함).

---

## 로드맵 설명

data-craft 코드 쿠폰 시스템 구현. 설계 동결 2026-06-18(메모리 project_data_craft_coupon_code_system_design).

**목표**: 관리자 발행 쿠폰 코드를 사용자가 보관함에 사전 등록 → 수동결제 시점에 현재 조건 맞는 쿠폰 선택 → 최종 결제액에 변동 할인율 적용. 추천 시스템(자동결제·적립형)과 정반대 축의 완전 독립 시스템, computeDeductionPlan 무손상으로 회귀 위험 0.

**핵심 설계**: 할인률(%) 단일, 할인액=min(최종×p, 캡), 일회성. 카테고리 OR 7종(enterprise 제외, 좌석=플랜우선·과금분해). 2단계 흐름(보관함 사전등록→결제 시 서버 자격평가 선택·견적 종속 자동취소·서버 재검증 진실원천). 3테이블+관리 감사 1테이블.

**순서**: dev DDL→BE 구축→FE 구축→prod DDL→origin push→i-dev→main 머지→배포. 첫달무료(Roadmap-10)·관리콘솔(Roadmap-7) 패턴 답습. 서비스 BE∥관리 BE(다른 repo 무의존, 그룹1), 양 FE(각 BE 의존, 그룹2).

**병렬 주의**: 병렬 plan-enterprise는 patch-note를 공유 I2 main 동시 author→버전 충돌 위험. 각 그룹에서 충돌 시 author 시점 max+1·머지 직후 dup grep·내 버전 중복이면 꼬리 renumber commit --amend로 회복(memory: patchnote_version_collision_shared_main). 부담되면 순차 실행.

**배포 대안**: Roadmap-10처럼 단독 배포 대신 누적 미배포분과 차기 범용 배포에 일괄 가능(그 경우 마지막 patch-confirmation→dev-merge→pre-deploy 3프롬프트는 범용 배포로 대체). 타이밍 마스터 결정.

**외부 전제**: prod 결제 PostgreSQL 컷오버 완료(Roadmap-6). 관리 콘솔 prod DB명=data_craft_production(메모리 admin_prod_datapool_db_name).
