# Roadmap 8: data-craft 결제 시스템 결함 수정

> 작성일: 2026-06-09 | 대상: data-craft-server 결제·구독·프로모션 결함 16건 순차 수정

## 프롬프트

🟢 /plan-enterprise data-craft data-craft-server 결제/구독 권한·접근 보안 강화 (3건, 런타임 정상동작 불변). [완료: 이슈 #271, patch-note v001.686.0] ① #4 프로모션 라우트 권한 우회: /api/promotion/* 가 src/app.ts 에서 permissionMiddleware 앞에 마운트돼 권한검사를 건너뛰고, promotion.routes.ts 의 /purchase·/cancel 핸들러와 promotion.service.ts 에 isOwner 검증이 없어 일반 회원이 대표 카드로 결제하거나 구독을 강등 가능 → 백엔드 핸들러에 대표(isOwner) 검증 추가(+가능하면 프로모션 라우트를 권한 미들웨어 뒤로 이동). ② #19 결제이력: /billing/history(getPaymentHistoryController) 가 대표 검증 없이 모든 회원에 노출 → isOwner 검증 추가. ③ #18 카드교체: /billing/change-card 가 requirePaymentPassword 없이 동작(삭제·결제·업그레이드는 요구) → 결제비밀번호 미들웨어 추가.

🟢 /plan-enterprise data-craft data-craft-server 요금 계산 정합 수정 — 견적≠실청구/과금 4건. [완료: 이슈 #274, patch-note v001.687.0] ① #2(CRITICAL) 협업 프로모션 즉시 인원추가 시 견적(getSeatChangeQuote)은 프로모션 스냅샷 단가인데 실청구(billingSubscription.service.ts executeUpgradeWithDiff)는 targetPlan===currentPlan 게이트가 프로모션 client(plan_type='free')에서 거짓이 되어 PLAN 정가로 계산→약 4배 과청구. 게이트를 effective plan(base_plan_type) 기준으로 고쳐 calculateProrationDiff 의 target 단가에 스냅샷 단가 적용(견적과 일치). ② #5 좌석 감소 다음주기 갱신 시 renewSingleClient 가 delta 적용 전 좌석으로 amount 계산→옛(높은) 좌석 과금 + payment_history seats 모순 → delta 적용 후 좌석으로 금액 산출. ③ #11 프로모션이 max_retention 보다 1개월 더 과금(3개월 특가가 4개월 청구). renewPromotionClient 종료 시점을 총 3개월(첫 달 포함)로 맞춤 — 안내 메일(findExpiryNotificationCandidates)은 이미 3개월 기준이라 현행 유지 시 자동 정합. ④ #15 구독 취소→재개 시 pending_billing_cycle 미초기화로 다음 갱신이 연간 청구 → cancelSubscription/reactivateSubscription 에서 pending_billing_cycle 도 초기화(deleteCard 패턴 참고).

🟢 /plan-enterprise data-craft data-craft-server 프로모션 무결성 수정 (3건). [완료: 이슈 #277, patch-note v001.697.0] 주의: 본 플랜은 로드맵 2번(요금 정합, #11 retention 종료 시점 수정)이 이미 i-dev 에 머지된 상태 위에서 작업한다 — renewPromotionClient 의 retention 비교 로직을 통째로 재작성하지 말고 #11 변경을 보존한 채 증분 수정. ① #3(CRITICAL) unpaid_business_once 구매가 charge 전 promotion_business_lock 에 PK INSERT(commit)하는데 charge 실패 시 rollbackActivation 이 잠금을 해제하지 않고 해제 경로 자체가 없어 결제 성공한 적 없는 정당 사용자의 재시도가 영구 차단 → 결제 실패 롤백 시 business_lock 해제. ② #8 retention 한도 우회: 해지는 옛 client_promotion 행에 +1 기록하나 재구매가 새 행을 consumed=0 으로 시작하고 누적 사용분을 빼지 않아 all/new_signup 프로모션을 해지·재구매 반복으로 한도 초과 사용(unpaid_business_once 는 payment_history 검사로 차단됨) → 재구매 시 동일 사업자+프로모션 누적 retention 반영(또는 구매 게이트에 누적 검사). ③ #20 프로모션 갱신 실패가 payment_history 에 FAILED 로 기록되지 않아 D-5/3/1 재시도 정책에서 제외 → 프로모션 갱신 실패도 FAILED 이력 기록.

🟢 /plan-enterprise data-craft data-craft-server 결제 동시성·멱등 보강 (3건). [완료: 이슈 #280, patch-note v001.703.0] ① #7 첫 결제(executeFirstPayment)가 charge 전 멱등/락이 없어 더블클릭/재시도 시 이중 결제 → withIdempotency 또는 디바운스/락으로 시스템적 차단(seatChange 의 withIdempotency 패턴 참고). ② #6 자동 갱신 cron 이 client 행 잠금 없이 옛 좌석을 읽어 동시 즉시 업그레이드의 좌석 증가를 덮어씀(lost update) → (a) 갱신 트랜잭션 내에서 좌석을 잠금 read(findClientSeatsForUpdate) 로 바꾸고, (b) **자동 갱신 cron 시각 ±N분 동안 결제성 API 요청을 거부하는 차단 윈도우 정책을 신규 도입**(단순 락 추가가 아니라 시간 윈도우 기반 요청 차단 — 마스터 지시). ③ #14 좌석변경 멱등키 ${companyId}:seat-change 가 delta/applyAt 를 안 담아 짧은 시간 내 서로 다른 요청이 결과 공유 → 멱등키에 delta/applyAt 포함.

🟢 /plan-enterprise data-craft data-craft-server 결제 안정성·스케줄러 보강 (3건). [완료: 이슈 #283, patch-note v001.708.0] ① #12 재시도 cron(processRetryPayments)이 최근 30일 FAILED 이력만 보고 현재 구독 회차 앵커가 없어 재가입 고객을 옛 실패 근거로 만료 5일 전 조기 청구 → 실패 이력을 현재 구독 episode 에 묶어 필터. ② #13 손상된 enc:v1 암호화 행 하나가 decryptBillingField throw 로 findBillingByCustomerKey/deactivateBillingByKey 전체를 500 으로 만들고 웹훅 무한 재시도 유발 → 복호화 루프(.find/.filter)에 행별 try/catch 격리. ③ #21 plan_expires_at < NOW() 이면서 is_auto_renew=1 인 클라이언트가 갱신 cron(만료 지남 제외)·만료 cron(자동갱신 켜짐 제외) 양쪽에 안 잡혀 무기한 무료 사용 → 두 cron 커버리지 공백 보강.

🟢 /plan-enterprise data-craft data-craft 결제 차단 윈도우 503 FE 처리 (Roadmap-8 후속). [완료: 이슈 #284, patch-note v001.714.0] data-craft-server #6b로 도입된 결제 차단 윈도우가 매일 00:50–01:10(서버 로컬타임) 결제성 API(/billing/payment·/billing/upgrade·/seats/change)에 503 BILLING_RENEWAL_IN_PROGRESS 를 반환한다. FE(data-craft)의 apiClient/에러 핸들러에서 이 503·error code(BILLING_RENEWAL_IN_PROGRESS)를 분기해 사용자 친화 메시지("자동 갱신 처리 시간대라 잠시 후 다시 시도해 주세요")와 재시도 유도로 처리한다(일반 에러 토스트로 떨어지지 않게).

🟢 /plan-enterprise data-craft data-craft-server 갱신 cron·차단 윈도우 TZ 명시 (KST, Roadmap-8 후속). [완료: 이슈 #286, patch-note v001.716.0] 현재 node-cron(갱신 0 1·만료 0 2·알림 0 9·청소 0 *·토큰 0 3)과 renewalWindowGuard가 서버 시스템 로컬타임에 의존해 서버 TZ가 KST가 아니면 의도한 KST 시각과 어긋난다. node-cron schedule에 { timezone: 'Asia/Seoul' } 옵션을 주고, renewalWindowGuard도 KST 기준(billing-date.util의 kstParts 패턴)으로 비교하도록 변경해 서버 TZ와 무관하게 결정적으로 동작하게 한다.

🟢 /plan-enterprise data-craft 결제 비밀번호 변경 = 대표(오너) 이메일 인증 전환 (Roadmap-8 운영 후속, 원 16건 스캔 외 마스터 독립 요청). [완료: 이슈 #287, patch-note v001.718.0] 결제 비밀번호 변경이 '현재 결제 비밀번호'를 요구해 비밀번호 분실 시 변경 자체가 불가했던 닭-달걀 결함을 수정. 변경을 대표(오너) 이메일 인증으로 대체하고, 변경 요청·인증 메일 발송을 모두 오너 계정으로만 가능하도록 BE에서 강제. **work_repo 2개**(본 로드맵 첫 BE+FE 동시 플랜) — ① BE `data-craft-server`: `POST /api/user/payment-password/send-verification`·`/change` 엔드포인트 신설(기존 set/verify/exists 무수정), `req.isOwner`+`findUserById` 오너 가드 2중, 오너 이메일 서버측 해석, `verifyEmail` 서버측 검증·소비 후 새 6자리 해시 저장. ② FE `data-craft`: 신규 `PaymentPasswordChangeDialog`로 PIN 확인 단계를 이메일 코드 입력으로 교체(verifyEmail 클라이언트 비호출·`/change`에 위임, BE 에러코드 6종 한국어 매핑), 공유 인증 훅 무수정 격리 복제. 잔존(범위 외 후속 후보): `email_verification_temp` purpose 미저장으로 login/결제 코드 상호 사용 가능, 신규 다이얼로그 weak-pin 검사 미복제.

---

## 로드맵 설명

data-craft 결제 시스템 전수조사(결제·구독·프로모션·협업·요금계산 5도메인 적대적 조사)에서 도출하고 마스터 답변 기준으로 전건 코드 재검증한 신규 결함 중, 마스터가 수정 확정한 16건을 5개 plan-enterprise 프롬프트로 분산한 로드맵.

**순차 실행(병렬 그룹 없음)**: 16건이 모두 data-craft-server 단일 i-dev 브랜치를 대상으로 하고 billingRenewal.service.ts / billingSubscription.service.ts / promotion.* / billingScheduler.service.ts 등 핵심 파일이 그룹 간 겹친다. plan-enterprise 는 완료 시 i-dev 자동 머지이므로 병렬 실행은 WIP·머지 충돌을 부른다. 위에서 아래 순서대로 하나씩 실행하고, 각 플랜이 i-dev 머지를 마친 뒤 다음 플랜을 시작한다.

**우선순위 근거**: ①권한/접근(비대표가 대표 카드 결제·구독 강등 — 보안), ②요금정합(견적≠실청구·과청구로 직접 금전 손해, #2 CRITICAL 4배 과청구 포함), ③프로모션 무결성(#3 CRITICAL 정당 사용자 영구 차단), ④동시성/멱등(이중과금·좌석 유실), ⑤안정성/스케줄러(조기청구·가용성·커버리지 공백) 순.

**제외(무시 확정 8건)**: #1 청소가 유료고객 카드 삭제(대표 탈퇴 아니면 무방), #9 charge 성공 후 재청구, #10 FOR UPDATE 중 PG호출(#6 조치가 해소), #16 재개 중 끊김, #17 카드삭제 순서, #22 만료알림 누락, #23-1 앵커 드리프트(앵커 복원 정상 — 비버그), #23-2 가입 7일 경계(문제없음).

**검증 공통**: 각 plan-enterprise 는 BE eslint 게이트가 타입에러를 못 잡으므로 페이즈마다 pnpm build(tsc) 직접 검증 + fresh 워크트리 pnpm install 선행. 모든 수정은 런타임 결제 정상 동작 불변이 목표.

**연관**: 본 로드맵은 별개로 동시 진행 중인 Roadmap-7(data-craft 관리자 페이지 — 프로모션 관리/분석)과 저장소·관심사가 다르나, 둘 다 프로모션 도메인을 건드리므로 관리자 콘솔의 프로모션 CRUD 작업과 본 로드맵 3번(프로모션 무결성)이 동시 진행될 경우 promotion.* 파일 충돌 가능 — 순서 조율 권장.

**운영 후속(6·7·8번, 1~5번 16건 수정 완료 후 보완 추가)**: 원 16건은 1~5번으로 전부 🟢 완료. 이후 작업 중 도출·요청된 운영 후속 3건을 6·7·8번에 추가했다. **6번**은 #6b 결제 차단 윈도우(매일 00:50–01:10 결제 API 503)의 **FE 표시 처리** — work_repo = `data-craft`(FE 저장소, 본 로드맵에서 server 외 첫 사례). **7번**은 cron/가드의 **TZ 명시(KST)** — work_repo = `data-craft-server`. **8번**은 **결제 비밀번호 변경의 오너 이메일 인증 전환**(원 16건 스캔 외 마스터 독립 요청) — work_repo 2개(BE `data-craft-server` + FE `data-craft`), 본 로드맵 첫 단일 플랜 내 BE+FE 동시 작업 사례. 6·7·8번은 서로 다른 work repo·파일군이라 진정 독립이나, plan-enterprise는 master 인터랙티브 실행 특성상 **순차로 두며 병렬 그룹 미사용은 의도**. (그 외 운영 인지 사항 — #21 과거 만료 auto_renew 결제 재개, 서버 TZ KST 점검 — 은 patch-note v001.703.0·v001.708.0 비고에 기록.)

**🎯 사이클 종결**: 2026-06-09 결제 도메인 전수조사(23 신규 결함 도출) → 2026-06-10 **8플랜 전부 완료**(원 16건 #271·#274·#277·#280·#283 + 운영 후속 3건 #284·#286·#287). 무시 확정 8건은 의도적 미수정. 잔여는 **운영 인지 사항(서버 TZ KST 점검·#21 과거 만료 결제 재개·db.ts:7 #258 잔존 lint·email_verification_temp purpose 미저장·#287 weak-pin 미복제)뿐, 추가 수정 프롬프트 없음.** 원격 반영은 patch-confirmation 으로 data-craft-server·data-craft origin push(#287 로 양 리포 모두 신규 미푸시 커밋 존재).
