# Roadmap 10: data-craft 첫달 무료 프로모션 구축

> 작성일: 2026-06-15 | 대상: basic급 0원 1개월 프로모션 — free(완전 구독 취소)·본 프로모션 미사용·비피추천 기업 한정 노출

## 프롬프트

🟢 /task-db-structure data-craft — 프로모션 시스템 DDL 보강: `promotion_eligibility_type_enum` 에 신규 값 `free_status_once` 추가 + `chk_promotion_price` 제약을 `monthly_price > 0` → `monthly_price >= 0` 으로 완화(0원 프로모션 허용). dev psql 적용 + prod 반영용 마이그레이션·롤백 파일 작성(prod 실적용은 4번 배포 시). additive·비파괴. ※ enum 값 추가는 PostgreSQL 에서 트랜잭션 제약 있음(ALTER TYPE ... ADD VALUE 는 일부 버전에서 트랜잭션 밖 실행 필요) — 마이그레이션 작성 시 엔진 동작 확인. **[완료 2026-06-16: `docs/migration/ddl-changes/20260616120000_promotion-zero-price-free-status-once/`(up/down/plan.md) 작성, advisor PASS, dev psql `data_craft_dev` 적용·검증 통과(enum 4값·`chk_promotion_price >= 0`), i-dev 머지 8c3e65f. prod 는 4번 배포 윈도우 수동 psql 적용 대기. down.sql CHECK 원복은 3번 0원 행 INSERT 이전에만 유효. PG16 은 트랜잭션 내 ADD VALUE 가능 — 우려한 트랜잭션 밖 실행 불요.]**

🟢 /plan-enterprise data-craft data-craft-server — 첫달 무료 프로모션 BE 자격·구매·갱신 로직(1번 DDL 선행 필수). 신규 `free_status_once` 분기를 자격조회(`promotion.service.ts getPromotionEligibility`)와 구매 재검증(`purchasePromotion`) **양쪽**에 추가 — 4중 게이트: ① `plan_type='free'` 만 노출(유료·해지신청 후 만료 전은 미노출) ② **B안 이력 게이트** `EXISTS(client_promotion WHERE promotion_id=본건 AND (status<>'cancelled' OR retention_consumed_months>0))` 차단 — 자연만료·중도해지는 영구 차단, 결제실패 롤백(cancelled+consumed0)만 재구매 허용(근거 주석: rollbackActivation 이 행을 cancelled+consumed0 으로 남기고 reason 컬럼 부재) ③ 피추천 제외 `EXISTS(referral_relation WHERE referee_company_id=본인)` 차단 ④ business_lock 사업자번호 단위 1회(기존 `unpaid_business_once` 패턴 재사용 — 동일 사업자 신규 계정 우회 차단). 추가로 **0원 갱신 보완**: `renewPromotionClient` 의 `monthlyGross<=0 → return false`(갱신 skip)를 "0원 결제 성공" 처리로 변경(charge 생략, retention+1·0원 payment_history·만료일 연장 수행 — 0원 다개월 무한유지 함정 제거). 빌링키(카드등록) 필수 유지(0원도 빌링키 없으면 BILLING_KEY_NOT_FOUND, 기존 동작)·구매 0원 경로는 기존 `chargeAmount>0` 가드로 무수정 통과. FE 는 기존 프로모션 모달 재사용이라 **무수정**(0원 표기만 확인). **검증: 양 프로모션(운영 기술 지원=priority100/all, 첫달무료=priority101/free_status_once) 동시 활성 상태에서 free/non-free 고객 자격 순서 dev 실측**(free→101 노출, non-free→100 fall through) + pnpm build(tsc) + fresh 워크트리 pnpm install 선행 + 적격/0원 경로 로컬 psql 실행 검증. 주의: `billingRenewal`·`billingSubscription` 은 추천인 #325·#326 머지 파일 — 기존 적립·차감·멱등 로직 보존한 증분 수정. **[완료 2026-06-16 (이슈 #335, plan-enterprise): 3페이즈 data-craft-server i-dev 머지 `cd1d800` — Phase1 `free_status_once` 타입+`hasNonRollbackPromotionHistory` 헬퍼(`acdc4cf`), Phase2 getPromotionEligibility+purchasePromotion 4중 게이트(자격조회 락 미호출/구매만 `acquireBusinessLock`, `9b42d03`), Phase3 renewPromotionClient `monthlyGross<=0` 조기반환 3곳 제거(방어적, `f0e16f8`). 각 페이즈 pnpm build(tsc)+lint exit 0, dev psql verbatim 실측(EXISTS 정상·게이트② 진리표 4케이스·enum 4값·`chk_promotion_price>=0`·기존 운영 프로모션 id=2/priority=100 라우팅 셋업) 확인, advisor #1·#2 PASS. patch-note `v001.799.0`(병렬 #336 v798 충돌→799 양보 정정). **dormant** — DML 행 미적용이라 런타임 미작동(기존 무회귀), 3번 INSERT 후 작동. push 미수행(표준 종료점).]**

🟢 /task-db-data data-craft — 첫달 무료 프로모션 행 1건 INSERT(1·2번 선행 필수 — enum·CHECK 완화·자격 분기 머지 후): `name='첫달 무료 프로모션'`, `base_plan_type=basic`, `monthly_price=0`, `is_collaboration=0`/`min_users=NULL`, `page_limit=7`, `group_limit=20`, `storage_limit=10GB`(10737418240), `file_size_limit=50MB`(52428800), `max_retention_months=1`, `display_start_at`=즉시/`display_end_at='2026-12-31 23:59:59'`, `eligibility_type='free_status_once'`, **`priority=101`**(기존 all 프로모션 priority=100 보다 높게 — `findActivePromotions` 가 `ORDER BY priority DESC` 라 free 고객이 본 프로모션을 먼저 만나 노출; 트리거 `trg_promotion_priority_insert` 가 동일 priority+윈도우 겹침 시 EXCEPTION 이므로 100 회피 필수), `detail_features`=베이직 플랜의 모든 기능 + 페이지·그룹·스토리지 추가 제공(파일 50MB 는 베이직과 동일이라 "추가" 항목 제외). dev psql INSERT + prod 반영은 4번 배포 시(또는 prod 행 INSERT 별도 포함 여부는 task-db-data 의 dev/prod 분리 정책 따름). **[완료 2026-06-16 (task-db-data, exec=dml-20260616012908-659b48): dev psql `data_craft_dev` INSERT 0 1 → id=3 행(basic/0원/priority=101/free_status_once, page7·group20·storage10GB·file50MB·retention1·노출 2026-06-16~12-31). i-dev 머지 `a5e2112`(capture/forward/rollback/plan.md audit). advisor PASS. 검증: 우선순위 정렬 `101→100` 정확, free client `aica` → 게이트①②③ 통과 → **101 노출**(#2 dormant BE 분기 실데이터 활성화 확인), `funshare`=id=2 사용 중 선차단. non-free client 가 dev 부재라 "→100 fall through" 는 논리 입증(BE 분기 #2 verbatim 검증 완료). **prod 행은 #4 배포 위임**(staging/prod 게이트 건너뜀). push 미수행.]**

> **[최종 통합 배포 — 모든 dev 작업·테스트 완료 후 맨 마지막에 1회]** 마스터 결정(2026-06-16): 이 프로모션만 따로 내보내지 않고, 누적 미배포분(이 프로모션 #335 BE + 그 외 병렬 작업)을 prod 에 일괄 반영한다. **순서 = prod DB 먼저(db-task 스킬) → FE·BE 동시 배포(pre-deploy).** `/pre-deploy` 는 DB 작업 능력이 없으므로 DDL/DML 은 반드시 db-task 스킬이 수행한다(하니스 §3 — DB 작업은 db-task 소유, 수동 psql 우회 금지). 착수 전제: #1~#3 + 그 외 모든 예정 작업이 dev/i-dev 완료·검증 후 main 정렬.

🟢 [최종 ④] /task-db-structure data-craft — **prod DDL**(첫달 무료 프로모션 #1 의 prod 적용): `free_status_once` enum 추가 + `chk_promotion_price > 0 → >= 0` 완화. 출처 마이그레이션 `data-craft-server/docs/migration/ddl-changes/20260616120000_promotion-zero-price-free-status-once/up.sql`(dev 적용 완료분과 동일). `분리` 정책상 dev 는 이미 적용됐으니 **dev 게이트 건너뛰기 → prod 게이트만 진행**. additive·CHECK 완화는 구버전 prod BE 와 공존 안전(선적용 OK). enum 추가는 비가역(무해 잔존). ⑤ DML 보다 **반드시 먼저**(0원 행 INSERT 전제). **[완료 2026-06-16 (task-db-structure): prod `data_craft_production`(211.x:5432) 적용·검증 — enum +free_status_once, chk_promotion_price `>= 0`, 무결성 bool_and=t(1행), 기존 id=2 무영향. dry-run skip(마스터 승인·멱등), IF EXISTS 견고화본, capture 스냅샷 보존. i-dev 머지 `f59caf3`. ⚠️ prod 라이브 DB명 = `data_craft_production`(db.md "postgres" 오기 — 실측 교정). advisor #1·#2 PASS.]**

🟢 [최종 ⑤] /task-db-data data-craft — **prod DML**(첫달 무료 프로모션 #3 의 prod 적용): 프로모션 행 1건 INSERT(dev `forward.sql` 과 동일, **priority=101 유지**). `분리` 정책상 dev 건너뛰기 → prod 게이트만. **prod psql 실측 선행**: 기존 운영 프로모션 priority=100 / priority=101·윈도우 겹침 행 부재 확인(트리거 `trg_promotion_priority_insert` EXCEPTION 회피). ④ DDL 적용 후에만 가능. **[완료 2026-06-16 (task-db-data, exec=dml-20260616024052-5dc3da): prod `data_craft_production` INSERT 0 1 → id=3(basic/0원/free_status_once/priority=101/retention1/노출~2026-12-31). 검증: 우선순위 101→100 정렬, prod client 모집단 free 3+premium 1(⑥ 배포 후 라우팅 작동). i-dev 머지 `8f91452`, advisor PASS. prod DB 완성 — 남은 건 ⑥ 앱 배포뿐. 현재 구 prod BE 가 분기 부재로 본 행 건너뜀(잠복, 무회귀).]**

🔴 [최종 ⑥] /pre-deploy data-craft — **FE·BE 앱 배포 동시**(④⑤ prod DB 완료 후): 멀티타깃 선택 `data-craft-server`(BE) + `data-craft`(FE) → 빌드 검증 → 배포. deploy.md 우선순위상 BE 먼저 → FE. ⚠️ **BE 선행 코드 갭**: prod psql 좌표 `PG_*_PROD` 분기(`constant.ts`)가 미구현이면 prod BE 가 dev psql 오접속(db.md §전환 상태) → `_PROD` 분기 코드 + EC2 `.env` `_PROD` 주입을 본 단계 **이전에** 별도 plan-enterprise 로 해소. BE = `pnpm build` → `main:aws-deploy` push → EC2 SSH `git pull && pnpm build && pm2 restart`(서버 직접 pull). FE = `pnpm build` → gh-pages. origin push 권한은 인자에 명시.

  종료: prod 노출 확인(free→첫달무료, non-free→기존 프로모션) + dev=prod 미러 확인.

---

## 로드맵 설명

### 목적

회사 요청 "첫달 무료" 혜택을 **별도 프로모션 상품**으로 구현한다. 기존 정규 결제 경로(billingSubscription/billingRenewal — 추천인 엔진까지 얹힌 최민감 파일)를 건드리지 않고, 이미 검증된 프로모션 인프라(자격 API·노출 윈도우·race-safe 구매·business_lock) 위에 basic급 0원 1개월 프로모션을 추가한다. 노출 대상은 **free 상태(완전 구독 취소) + 본 프로모션 미사용 + 비피추천 기업**.

### 동결 스펙 출처

마스터 4차 왕복 검토로 동결(2026-06-15). 전문은 메모리 `project_data_craft_first_month_free_promo_spec.md`. 추천인 시스템(Roadmap-9) 5·6번 완료가 착수 전제였고 2026-06-15 prod 배포로 충족됨(`referral_relation` 의존·갱신 파이프라인 정합 확보).

### 핵심 결정

- **조건1(미사용 1회) = B안 이력 EXISTS 게이트**: A안(구매 시 initialConsumed=1)은 결제실패 롤백 고객을 영구 차단(빌링키 필수 결정과 충돌) + 쓰기경로 2곳 수정이 필요해 기각. B안은 읽기 전용 자격 판정 하나로 자연만료·중도해지·롤백을 모두 올바르게 분기(롤백 행이 cancelled+consumed0 으로 남고 reason 컬럼이 없다는 구조를 판정식으로 활용).
- **조건3(free만 노출)**: `plan_type='free'` 게이트. 해지 신청 후 만료 전 고객은 plan_type 이 아직 유료라 자동 미노출 — "완전한 구독 취소" 정의와 일치.
- **조건4(0원)**: `chk_promotion_price` 를 `>=0` 으로 완화(현행 `>0` 이 0원 INSERT 자체를 거부). 구매·갱신의 0원 경로는 기존 코드(`chargeAmount>0` 가드, 0원 payment_history 기록)에 이미 존재.
- **빌링키 필수**: 카드 등록 후에만 0원 구매 가능(전환 유도). 코드 무수정.
- **피추천 제외**: 피추천 기업은 이미 추천인 혜택(2·3·4회차 무료)을 받으므로 중복 차단.

### priority 라우팅 (advisor 지적 — invisible-promotion 함정)

기존 "운영 기술 지원 프로모션"(eligibility_type=all, priority=100, 노출 ~2026-12-31)과 본 프로모션의 노출 윈도우가 겹친다. `getPromotionEligibility` 는 우선순위 1개만 반환하고 `findActivePromotions` 가 `ORDER BY priority DESC` 다. free·미사용·비피추천 고객은 **두 프로모션 모두 자격**(all 분기는 consumed≥maxRetention 만 보는데 0≥12=false 라 항상 적격). 따라서 본 프로모션 priority 가 ≤100 이면 기존 14,900원 프로모션이 노출되고 첫달무료는 전 대상에게 영원히 안 보인다. → **priority=101**(>100)로 설정해 free 고객은 101 을 먼저 만나 노출, non-free·기사용·피추천 고객은 free_status_once 게이트 fail → `continue` → 100 all 프로모션으로 fall through(아무것도 안 보이는 게 아니라 기존 프로모션 노출 — "이 프로모션에서만 제외"와 일치). 트리거 `trg_promotion_priority_insert` 는 동일 priority+윈도우 겹침 시 EXCEPTION 이라 100 회피가 강제 사항.

### 0원 갱신 무한유지 함정 보완

`renewPromotionClient` 의 `monthlyGross<=0 → return false`(갱신 통째 skip)는 retention++ 가 영영 안 일어나 0원 다개월 프로모션이 무한 유지된다. 본 스펙(1개월)은 첫 갱신 전에 만료되어 도달하지 않지만, CHECK 완화 후 향후 0원 다개월 구성의 함정이므로 "0원 결제 성공"(charge 생략 + retention+1 + 0원 payment_history + 만료일 연장)으로 보완해 원천 제거. 선례: 프로모션 구매 0원 경로, #326 정규 갱신 0원 경로.

### 위험

- **enum 추가 트랜잭션 제약**: PostgreSQL `ALTER TYPE ... ADD VALUE` 는 일부 버전에서 트랜잭션 밖 실행 필요 — 1번 마이그레이션 작성 시 엔진 동작 확인(롤백 파일 포함).
- **billingRenewal 증분 수정**: 추천인 #325·#326 적립·차감 훅이 머지된 파일 — 통째 재작성 금지, 0원 갱신 보완은 기존 로직 보존한 증분.
- **prod priority 충돌**: prod 에도 동일 운영 프로모션(priority=100)이 존재하므로 prod 행 INSERT 시에도 priority=101 유지 — dev/prod 동일.

### 종료 조건

- 1~3번 i-dev 머지 + dev 실측(양 프로모션 자격 순서·0원 구매·만료) 통과. **(2026-06-16 완료 — #1·#2·#3 🟢)**
- **최종 통합 배포 = ④⑤⑥ 3스킬 순차**(2026-06-16 마스터 결정, 4번 단일 pre-deploy 에서 분해): prod DB 먼저 → FE·BE 동시. ④ `/task-db-structure`(prod DDL) → ⑤ `/task-db-data`(prod 행 INSERT) → ⑥ `/pre-deploy`(BE+FE 앱 배포). `/pre-deploy` 는 DB 능력이 없어 DDL/DML 은 db-task 스킬이 소유(하니스 §3, 수동 psql 우회 금지). 이 프로모션만 단독 배포하지 않고 누적 미배포분과 한 윈도우에 일괄. 합격 = prod 노출 확인(free→첫달무료, non-free→기존 프로모션) + dev=prod 미러 확인. 그때까지 prod 무변경(프로모션은 dev 잠복 대기 — 구 prod BE 는 `free_status_once` 분기 부재로 무회귀).
