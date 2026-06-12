# Roadmap 9: data-craft 추천인 시스템 구축

> 작성일: 2026-06-12 | 대상: data-craft(FE)+data-craft-server(BE) 추천인 시스템(쿠폰+크레딧) 신규 구축 — 2026-06-12 동결 스펙

## 프롬프트

🔴 /task-db-structure data-craft 추천인 시스템 신규 DDL. ① 추천 관계 테이블: 피추천 기업당 1행 유니크(company_id UNIQUE), 추천인 company_id FK, 양측 "지급된 개월치" 누적 카운터(평생 한도 3개월치 강제용, 피추천·추천인 각각), 해지 소멸 플래그(피추천이 무료 전환되면 양측 잔여 한도 소멸·이후 추천인 10%만), 피추천 최초 결제 사용 여부(기업당 평생 1회). ② 쿠폰 원장: 건별 1행(소유 기업, 지급 사유=피추천 가입 귀속, 지급일, 만료일=지급+2년, 소모일·소모 결제 식별자 NULL허용), 짧은 만료 순 소모 쿼리 지원 인덱스. ③ 크레딧 원장: 건별 적립 1행(소유 기업, 적립 원천 결제 식별자, 적립 구분=100%구간/10%구간, 금액, 만료일=지급+2년) + 차감 이력(차감 대상 결제, 원장 행별 차감액 — 부분 차감 지원), 짧은 만료 순 소모 인덱스. 잔액은 원장 합산으로 도출(잔액 컬럼 단독 금지). ④ payment_history 에 source 컬럼 추가(auto-renewal/first-payment/upgrade/promotion 등 — 현재 자동/수동 미구분이며 적립·차감 규칙 전체가 이 구분에 의존). ⑤ client 에 추천 코드 컬럼(기업당 고유, 오너 노출용). dev psql 적용 + prod 반영용 마이그레이션·롤백 파일 작성(prod 실제 적용은 로드맵 6번 배포 시).

🔴 /plan-enterprise data-craft data-craft-server 추천인 가입·귀속 계층 (Roadmap-9 2번, 1번 DDL 선행 필수). ① 오너 추천 코드 발급/조회 API: client 추천 코드 lazy 발급(첫 조회 시 생성), 오너(isOwner) 전용, 쿠폰 수·크레딧 잔액(원장 합산)·지급된 개월치 현황 포함 단일 조회 엔드포인트(계정정보 ?모달용). 응답은 표준 봉투(buildAuthResponse) 필수. ② 회원가입 추천 코드 검증: 기업 회원가입(signup)에 선택 인자 referralCode 추가 — 존재·활성 검증, 자기 사업자번호 차단, 실패 시 가입 전체 중단(원자적, 부분 생성 금지)하고 FE 가 폼 데이터를 유지할 수 있는 구분 에러코드 반환. ③ NTS 서버 재검증: 현재 routes/auth.ts 의 validate-business-number 는 FE 버튼용 상태조회뿐이고 signup() 은 정규식만 검사하는 우회 갭 존재 — 추천 코드가 첨부된 가입은 가입 트랜잭션 안에서 서버가 NTS 상태조회를 재호출해 통과해야만 귀속 성립(NTS 장애 시 가입은 진행하되 추천 귀속만 거부할지, 가입 자체를 중단할지는 플랜에서 안전한 쪽 채택·명시). ④ 귀속 기록: 추천 관계 테이블 1행 생성(피추천당 1행 유니크). ⑤ 가입 성공 시 추천인에게 쿠폰 3장 지급(원장 3행, 만료=+2년). BE eslint 게이트는 타입에러 미검출 — 페이즈마다 pnpm build(tsc) 검증 + fresh 워크트리 pnpm install 선행.

🔴 /plan-enterprise data-craft data-craft-server 추천인 크레딧 적립 엔진 (Roadmap-9 3번, 2번 선행 필수). 수동 최초 결제(billingSubscription.service.ts executeFirstPayment)와 자동 갱신(billingRenewal.service.ts renewSingleClient·renewPromotionClient)에 적립 훅 추가. 규칙(동결 스펙): ① 평생 한도 = 양측·양주기 공통 3개월치, 매 결제 시 지급 개월치 = min(잔여 한도, 이번 결제의 개월 환산). 월간 결제 = 1개월치(1·2·3회차 100%), 연간 결제 = 3개월치 1번(연간액÷4 — 추천인·피추천 동일 ÷4). ② 추천인은 한도 소진 후 실결제액의 10% 영구 적립(월간 4회차~, 연간은 2번째 연간결제~). ③ 적립 기준 하이브리드: 100% 구간 = 쿠폰·연간할인 적용 후·크레딧 차감 전 금액(피추천이 2·3·4회차 연속 3개월 무료가 되도록 — 0원 결제에도 100% 구간 적립은 정상 발생), 10% 구간 = 실결제액(0원 결제 적립 0 — 담합 루프 차단). ④ 피추천의 수동 "최초 결제"는 적립 대상이되 기업당 평생 1회(재구독 무효), 그 외 수동 결제(업그레이드·프로모션 구매·인원 추가)는 적립·차감 모두 무관. ⑤ 0원 결제도 회차·한도 카운트. ⑥ processExpiredPlans(billingScheduler.service.ts)의 무료 전환 시점에 해당 추천 관계의 양측 잔여 한도 소멸 처리(이후 추천인 10%만). payment_history.source 를 모든 결제 기록 경로에서 정확히 기록. 주의: billingRenewal·billingSubscription 은 Roadmap-8 에서 16건 결함 수정이 머지된 파일 — 기존 로직(멱등·차단 윈도우·좌석 delta·프로모션 retention)을 보존한 증분 수정. 페이즈마다 pnpm build(tsc) + fresh 워크트리 pnpm install, 적립 로직은 로컬 psql 실행 검증 포함.

🔴 /plan-enterprise data-craft data-craft-server 추천인 쿠폰·크레딧 차감 엔진 + 예정 금액 단일 소스 (Roadmap-9 4번, 3번 선행 필수). ① 자동결제일 금액 계산(billingRenewal)에 차감 파이프라인: 쿠폰 1장 자동 적용(잔여 쿠폰 있으면 무조건 소모, 1회 1장, 청구액 20% 할인, 연간결제 병용 시 합산 30% = 금액×0.7 단일 곱 — 0.9×0.8 순차곱 금지, 원 단위 절사 규칙 명시) → 크레딧 차감(짧은 만료 순, 0원까지, 잔여는 유지). 수동 결제 경로에는 쿠폰·크레딧 미적용. ② 차감 후 0원이면 토스 PG 호출 생략하고 내부 결제 기록만 생성(payment_history 정상 기록, 회차·anchor·만료일 갱신 동일) — 0원도 자동 결제 회차로 카운트되고 쿠폰도 소모됨. ③ 만료 처리: 매일 스케줄러에서 만료일 경과 쿠폰·크레딧 소멸 처리(무보상), 자동결제 당일은 결제 처리 후 만료 판정 순서 보장. ④ 결제 예정 금액 BE 단일 소스: /api/subscription/status(또는 신설 엔드포인트)에 쿠폰·크레딧 반영 예정가 + 적용 내역(쿠폰 적용 여부·크레딧 차감 예정액) 포함 — FE 자체 계산 대체 목적. 주의: 차감은 charge() 호출 전 금액 확정 단계, 적립(3번 머지분)은 결제 후 단계 — 3번 변경 보존한 증분 수정. 페이즈마다 pnpm build(tsc) + fresh 워크트리 pnpm install, 차감·0원 경로는 로컬 psql 실행 검증 포함.

🔴 /plan-enterprise data-craft data-craft 추천인 FE 계층 (Roadmap-9 5번, 4번 선행 필수 — BE API 의존). ① 가입 폼(src/pages/auth/signup/): 추천 코드 선택 입력 필드를 대표자 정보의 비밀번호 확인 아래 추가 — 평소 노출하되 비활성, 사업자번호 NTS 인증 통과 시에만 활성, 인증 후에는 사업자번호 입력란 잠금(재입력 시 인증·추천 코드 활성 해제), 가입 시 코드 검증 실패하면 폼 데이터 유지한 채 사유 안내(코드 없음/오류/추천 불가 구분, BE 에러코드 매핑). ② 계정정보(AccountTabContent.tsx): 가입일시 아래 "내 추천 코드"+? 항목(오너 전용 — 기존 {userInfo?.isOwner && ...} 패턴), 우측에 기업 아이디 표기, ? 클릭 시 안내 모달 — 카드 형태로 코드 활용법·이득 극대화 방법 설명 + 현재 쿠폰 수·크레딧 잔액 표시 + 고지 5항목(타인 사업자번호 악용 시 불이익 / 쿠폰·크레딧 유효기간 2년·만료 소멸 무보상 / 연간 구독자는 결제가 연 1회라 쿠폰 3장 중 ~2장만 사용 가능 / 무료 플랜 상태 적립분은 구독 후 다음 자동 청구일부터 사용 가능 / 해지 시 양측 혜택 소멸). 신규 폼 입력은 bare primitive dress 요건(w-full 등) 준수, 모달형 커스텀 createPortal 이면 useScrollLock+data-scroll-container 필수. ③ 플랜 관리(SubscriptionActionSection.tsx): 결제 예정 금액을 4번의 BE 단일 소스 값으로 교체하고 쿠폰·크레딧 적용 시 "쿠폰 적용 값" 추가 표기(FE 자체 계산 제거). ④ 해지 다이얼로그(CancelSubscriptionDialog): 추천 귀속 기업의 해지 신청 시 양측 혜택 소멸 경고 2건(추천한 회사 측 혜택 소멸 + 본인 회사가 받을 혜택 소멸) 표시, 만료 전 재활성화 시 유지된다는 안내 포함. lint 게이트는 fresh 워크트리 pnpm install --prefer-offline + build:packages 선행.

🔴 /pre-deploy data-craft 추천인 시스템 배포 (Roadmap-9 6번, 1~5번 전부 완료·i-dev 검증 후). 배포 전 1번에서 작성한 prod 마이그레이션 SQL 을 prod psql 에 적용(코드 배포보다 DDL 선행 — 신규 테이블·컬럼은 additive 라 구버전 코드와 공존 안전), 이후 data-craft-server·data-craft 빌드 검증·배포. dev=prod 미러 상태 유지 확인.

---

## 로드맵 설명

마스터가 2026-06-12 4차 왕복 검토로 동결한 추천인 시스템 스펙(상세 전문: 메모리 `project_data_craft_referral_coupon_plan.md`)을 6개 프롬프트로 분해한 로드맵. 경영안("양측 3개월 무료")을 자동결제 전용 비례 보상(쿠폰 = 추천 행위 보상, 크레딧 = 결제 성과 보상)으로 구현한다.

**스펙 핵심 결정**(각 프롬프트에 분산 기재된 규칙의 출처): 평생 한도 3개월치 단일 규칙(min(잔여, 개월 환산) — 월간·연간·중도 전환 모두 일관), 적립 기준 하이브리드(100% 구간 = 크레딧 차감 전 / 10% 구간 = 실결제 — 피추천 연속 3개월 무료 보장과 담합 루프 차단 동시 달성), 유효기간 2년·무보상·짧은 순 소모(건별 원장 강제), 0원 결제도 회차 카운트·쿠폰 소모, 환불·취소·CS 보정 도구 의도적 미구축, NTS 서버 재검증으로 FE-only 검증 우회 갭 봉쇄.

**순차 실행(병렬 그룹 없음)**: 1번 DDL 이 2~5번의 전제, 2~4번이 단일 i-dev 에서 billingRenewal/billingSubscription/billingScheduler 등 핵심 결제 파일을 공유, 5번 FE 가 2~4번의 API 에 의존, 6번이 전체의 배포. Roadmap-8 과 동일 근거로 병렬 불가.

**적립(3번)·차감(4번) 분리 근거**: 둘 다 자동결제 파이프라인이지만 차감은 charge 전 금액 확정, 적립은 결제 후 기록으로 관심사가 다르고, Sonnet 실행 에이전트 컨텍스트 한계(CLAUDE.md §4 분할 의무)에 맞춘 분할.

**위험**: ① billingRenewal·billingSubscription 은 Roadmap-8 의 16건 결함 수정이 누적된 파일 — 각 플랜은 통째 재작성 금지, 기존 멱등·차단 윈도우·좌석 delta·프로모션 retention 로직 보존한 증분 수정(프롬프트에 명시). ② 0원 결제 내부 기록 경로는 PG 응답이 없는 신규 결제 형태 — payment_history 스키마 호환(paymentKey 등 NULL 처리) 확인 필요. ③ prod DDL 은 additive 전용으로 설계해 코드 배포 전 선적용 안전성 확보(6번). ④ 결제 표준모델(billing_anchor_day) 위에 구축 — 선행 전제였던 prod psql 컷오버(Roadmap-6)는 2026-06-11 종결로 충족.

**검증 공통**: BE eslint 게이트는 타입에러 미검출 → 각 플랜 페이즈마다 pnpm build(tsc) 직접 검증 + fresh 워크트리 pnpm install 선행(Roadmap-8 관례). 적립·차감·0원 경로는 로컬 psql 실행 검증 포함. FE 는 fresh 워크트리 install + build:packages 선행.
