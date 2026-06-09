# Roadmap 7: data-craft 관리자 페이지 — 프로모션 관리 + 자체 호스팅 분석

> 작성일: 2026-06-09 | 대상: data-craft 그룹 — 관리자 콘솔(신규 2저장소) + 본체 분석 계측

## 프롬프트

🟢 (수동) data-craft-admin · data-craft-admin-server 저장소 생성 + 그룹 등록 — ⓐ 빈 저장소 git init + GitHub remote + 최소 스캐폴드(매니페스트 등록 가능 수준), ⓑ data-craft 그룹 매니페스트 4종(dev/deploy/db/group)에 멤버 추가(배포 제외=deploy_command 미부여, i-dev 필수, role FE/BE, dev_command/port 기입), ⓒ 각 repo i-dev 부트스트랩. ※ 전용 스킬 부재 → 수동 편집 경로

🔴 /task-db-structure data-craft (prod) — **이미 빌드된 prod psql(`data_craft_production`)에 `user_events` additive CREATE 마이그레이션 DDL 작성**(RANGE(created_at)월별 + HASH 8 파티션; auth_state/user_id/anon_id/company_id/event/page/dwell_ms/created_at). Roadmap-6 prod 빈 스키마 빌드(프롬프트4)가 **이미 🟢 완료**되어 빌드 DDL 편입은 무의미 → 비파괴 CREATE 마이그레이션으로 추가(P3 dev 와 동일 캐노니컬 DDL 재사용). **실행은 운영 오케스트레이션이 컷오버 다운타임 윈도우에**(db.md 정책), **트랙 A 의 prod 인입 배포 전 완료** 필요. ※ admin_email_verification 은 dev 전용(P3)이라 prod 제외. ※ Roadmap-6 는 본 결정으로 **무변경**(빌드 DDL cross-edit 폐기)

🔴 /task-db-structure data-craft — [dev] 분석 `user_events`(위 shape) + 관리자 `admin_email_verification`(이메일 인증번호: code/issued_at/expires_at/consumed/attempt_count) 테이블 추가 (dev psql). ※ 고정 계정이라 admin_user/session 테이블 불요; 인증번호 테이블은 토글과 분리된 고정 dev 연결로만 사용

1️⃣ 🔴 /plan-enterprise data-craft — [트랙 A] 분석 이벤트 인입(배포 본체): ⓐ 로그인 surface = RootLayout 계측 hook(페이지뷰·체류시간·기능사용, userId/companyId), ⓑ 비로그인 surface = guest 라우트(`/signin`·`/signup`·`/login`·`/register` 등 RootLayout 밖)에 별도 hook(anon_id) + 가입 전환 anon→user stitch, ⓒ 결제 화면·기능 이벤트 생성 계측(Upgrade*/CancelSubscriptionDialog/Toss success·fail), ⓓ data-craft-server 인입 엔드포인트(인증/비인증 둘 다 수용, 전용 rate-limit, buildAuthResponse 봉투)

1️⃣ 🔴 /plan-enterprise data-craft — [트랙 B] admin 골격: admin-server 인증 — **고정 단일 계정(env 보관, 비밀번호 해시, 회원가입·비번찾기 없음)** + **2단계 로그인**(이메일+비번 일치 → 인증번호 이메일 발송[data-craft SMTP 패턴 이식] → 고정 dev 연결 `admin_email_verification` 대조 → 통과 시 토큰 발급) + **토큰 방식, 별도 토큰 키 `ADMIN_JWT_SECRET`**(data-craft JWT 와 분리). 보안: 로그인 엔드포인트 brute-force rate-limit(고정 단일 계정=알려진 표면), 인증번호 정책(expiry 5–10분·코드당 최대 시도수·시간당 발송 max), 토큰 만료/갱신 전략(짧은 만료 또는 refresh). 로그인은 데이터 토글과 무관. + dev/prod psql 런타임 토글(데이터 작업용; prod 토글은 PROD-1 코드 전까지 차단 + 빨간 배너) + admin-web 셸 스캐폴드(라우팅 + recharts 도입)

🔴 /plan-enterprise data-craft — [트랙 C] 프로모션 admin CRUD: admin-server CRUD(쓰기 전 setPromotionAuditContext → promotion_audit_log) + admin-web 목록/생성/편집/활성토글/현황(활성·만료예정·eligibility 분포)/통계

🔴 /plan-enterprise data-craft — [트랙 D] admin 대시보드: 분석 읽기(로그인/비로그인 분리 집계·탭) + 결제 funnel 분석·시각화(트랙 A 가 생성한 결제 이벤트 → 단계별 이탈·취소 지점) + 비가역 작업 confirm 게이트. ※ 계측 생성은 트랙 A, 본 트랙은 조회·집계·시각화

2️⃣ 🔴 /dev-security-inspection data-craft — admin 인증 보안 점검: 고정 계정 자격증명 env 분리(하드코딩 0)·로그인 brute-force rate-limit·인증번호 정책(expiry/시도수/발송 max)·토큰 만료·별도 키 분리·prod DB 토글 권한 경로

2️⃣ 🔴 /db-security-inspection data-craft — `admin_email_verification`·`user_events`(비로그인 인입 abuse)·prod 접속 권한/제약 점검

---

## 로드맵 설명

data-craft 의 ① DB 직접 INSERT 로만 하던 프로모션 운영을 UI 콘솔로, ② 부재하던 사용자 행동/결제 분석을 외부 서비스 없이 자체 구축한다. 관리자 콘솔은 신규 2저장소(`data-craft-admin`/`data-craft-admin-server`)로 분리하되 **배포 제외·pnpm dev 전용·i-dev 필수**이고, dev/prod psql 을 런타임 토글로 전환해 양쪽 데이터를 관리·조회한다(DB 인스턴스는 dev 1·prod 1 유지, 관리자 테이블만 기존 DB에 추가).

관리자 인증: 고정 단일 계정(`manager@funshare.co.kr`, 비밀번호 env 해시 보관)으로 회원가입·비밀번호찾기가 없다. 로그인은 2단계 — 이메일+비밀번호 일치 시 인증번호를 이메일 발송하고, 인증번호까지 맞아야 토큰을 발급한다. 토큰은 data-craft 와 분리된 별도 키(`ADMIN_JWT_SECRET`)로 서명한다. 로그인은 데이터 토글과 무관하므로 dev/prod 어느 쪽을 보든 동일 고정 계정으로 접속한다.

핵심 제약: 분석 이벤트는 prod 실사용자가 생성하므로 **인입은 배포되는 data-craft 본체**(트랙 A)가 담당하고, dev 전용 admin은 토글로 읽기만 한다. 수집·분석은 **로그인/비로그인 분리**한다 — 비로그인은 RootLayout 밖 guest 라우트에 별도 계측 hook(익명 anon_id, 인증 불요 인입 경로), 로그인은 RootLayout hook(userId/companyId), 가입 전환은 anon→user stitch 로 잇는다. 결제 이벤트 **생성**은 트랙 A에 모으고, 트랙 D는 그 데이터의 funnel **분석/시각화**만 담당한다.

실행 순서: 저장소 생성·그룹 등록(P1) → prod psql 에 `user_events` additive CREATE 마이그레이션(P2, 실행은 컷오버 윈도우 운영 게이트) · dev DB 테이블(P3) → 트랙 A(본체 인입)·트랙 B(admin 골격)는 저장소가 겹치지 않아 **병렬 그룹 1** → 트랙 C(프로모션 CRUD, admin 골격 의존) → 트랙 D(대시보드, 이벤트 데이터·admin 골격 의존) → 보안 점검 **병렬 그룹 2**.

의존성/위험:
- prod `user_events` = Roadmap-6 빈 스키마 빌드(프롬프트4) **🟢 완료 후라 별도 additive CREATE**(P2 — 빌드 DDL cross-edit 폐기, Roadmap-6 무변경). prod DDL 실행은 컷오버 다운타임 윈도우/운영 오케스트레이션 게이트(db.md), 트랙 A 의 prod 인입 배포 전 완료 필요. prod 토글 활성화는 Roadmap-6 의 `PG_*_PROD` 분기(🟢 완료)에 의존. admin 인증 테이블은 dev 전용이라 prod 무관.
- 그룹 멤버 추가 전용 스킬 부재 → P1 수동 편집.
- `plan-enterprise` cross-repo 한계 → 트랙당 저장소 2개 내외로 스코프 유지(A: data-craft+server, B: admin 2종, C: admin 2종, D: admin+본체 결제 계측은 A에서 선처리).
- 신규 직접 dep(recharts) 도입 → fresh worktree `pnpm install` + (data-craft) `build:packages` 선행.
- **admin-server 는 별도 pg 풀 2개** 필요 — ① 고정 dev 인증 풀(`admin_email_verification`), ② 토글되는 데이터 풀(프로모션·분석). 한 풀에 토글을 끼워넣지 말 것(인증 코드가 토글된 prod psql 에 쓰이면 보안 사고). 트랙 B 첫 phase 에서 두 풀 분리 골격 선행.

진행 현황:
- **P1 완료 (2026-06-09)**: bj-kim-funshare 소유 `data-craft-admin`·`data-craft-admin-server` genesis 커밋 push, 그룹 매니페스트 4종(dev/deploy/db/group) 등록 main 머지. i-dev 는 첫 plan-enterprise 시 lazy-create.
- **P2 재정의 (2026-06-09)**: Roadmap-6 프롬프트4(prod 빈 스키마 빌드)가 **이미 🟢 완료**됨을 확인 → 빌드 DDL 편입(`/plan-roadmap 6` cross-edit)은 무의미해져 **폐기**. P2 를 **prod psql 별도 additive CREATE 마이그레이션**(`/task-db-structure data-craft`)으로 전환. **Roadmap-6 는 무변경**.
