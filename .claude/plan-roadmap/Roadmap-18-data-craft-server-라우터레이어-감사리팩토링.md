# Roadmap 18: data-craft-server 라우터 레이어 감사 리팩토링

> 작성일: 2026-06-25 | 대상: data-craft-server 진입→엔드포인트 레이어 (컨벤션·정리·버그 / 기능 무변경 순수 리팩토링)

## 프롬프트

🟢 /plan-enterprise data-craft [P1·안전망 선행] 회귀 골든 스냅샷 하니스 구축 — dev 서버 대상 대표 엔드포인트(공개 signin/health, 보호 대표 GET 1~2개+토큰, route-custom-auth subscription /plans·/webhook/toss, sse)의 요청→응답(상태코드+바디 형태)을 골든으로 캡처하고 재생·diff 스크립트를 만든다. 이후 모든 단계가 이 골든을 재생해 회귀 0 을 파서 독립적으로 확인(spec-dashboard 추출기는 보조 미터). 코드 동작 무변경, 테스트 자산 추가만.

🟢 /plan-enterprise data-craft [P2·버그] rateLimiter.middleware.ts 의 rate-limit export(authLimiter·strictLimiter·apiLimiter·paymentVerifyLimiter·analyticsLimiter)에 express-rate-limit 의 RateLimitRequestHandler 명시 타입 주석 부여 → 선언(.d.ts) 방출 시 TS2742 포터빌리티 오류 해소. 순수 타입 주석, 런타임 무변경. pnpm build(tsc) 검증.

🟢 /plan-enterprise data-craft [P3·버그] src/routes/test.ts 의 /notification 테스트 핸들러 catch 에 잘못 복붙된 CALL_ID.test.token 을 알림 전용 CALL_ID 로 교정(+동일 복붙 추가 점검). 에러 로그 오분류 수정, 동작 무변경.

🟢 /plan-enterprise data-craft [P4·정리] 죽은/임시 코드 제거 — src/routes/v2/ DEPRECATED 빈 스텁 디렉토리 전체 + debug-chain 임시 디버그 라우터(app.ts 조건부 마운트 + routes 등록 + 잔존 FE 호출 포함). 미마운트/prod-비활성 코드라 동작 무변경. 골든 재생으로 무영향 확인. [완료: #469 `c64d7d2`, −92줄, 골든 8 PASS/0 FAIL, patch-note v001.1116.0]

🟢 /plan-enterprise data-craft [P5·정리] src/routes/auth.ts 중간(line 162)에 끼어있는 initController import 를 파일 최상단 import 블록으로 이동 + promotion.routes.ts 미들웨어 import 출처 혼재(배럴 ../middlewares vs 직접 ../middlewares/auth.middleware) 통일. 순수 정리, 동작 무변경. [완료: #471 `16a2cab`, +2/−3, 직접경로 통일(11 vs 4), 골든 8 PASS/0 FAIL, patch-note v001.1117.0]

🟢 /plan-enterprise data-craft [P6·컨벤션 명명] 라우터 명명 규칙 전수 통일 — src/routes/ 라우터 25개를 {고유명칭}.router.ts 파일명 + `export const {고유명칭}Router = Router()` 명명 export 로 통일(.routes.ts 2개 포함; index.ts barrel 은 집약기라 별도 판단). ★rename 전 각 라우터 모듈을 import 하는 전 지점을 repo 전역 grep(routes/index.ts·app.ts·테스트·배럴·spec-dashboard 추출기·교차 import)해 빠짐없이 동기화 — 누락 1건이면 부팅 크래시. ★HTTP 경로·메서드·동작·마운트 순서 절대 무변경(rename+import 동기화만). pnpm build(tsc) + 서버 부팅 + 골든 재생 + 엔드포인트 수(225) 대조로 회귀 0 검증. [완료: #474, 라우터 23개(=routes/ 실측, index 제외)→.router.ts/export const, 5페이즈, advisor BLOCK(추출기 3중 파손)→개정 해소, 3중 게이트(콜드부팅 200·골든 8 PASS·추출기 225 튜플집합 S_old 동일)로 라우팅 표면 100% 보존, patch-note v001.1121.0]

🟢 /plan-enterprise data-craft [P7·컨벤션 비즈로직] 라우터 인라인 비즈니스 로직을 컨트롤러(필요 시 서비스)로 추출 — file.ts(SQL/트랜잭션/FS)·sse.ts(/connect 오케스트레이션)·auth.ts(/validate-business-number NTS 분기)·files.ts(그룹 매핑/집계). 라우터는 위임만 남김. ★요청/응답/상태코드/부작용 절대 무변경(로직 위치 이동만). 골든 재생 검증. [완료: #479, 5페이즈 verbatim, 컨트롤러 3신규+auth 추가, advisor BLOCK(verbatim-vs-Promise<void>)→해소, 골든 8 PASS+추출기 (method,full_path) 225 델타0+P4 ALL-VERBATIM diff, patch-note v001.1126.0]

🔴 /plan-enterprise data-craft [P8·컨벤션 인증형태 ★최고위험] 인증 미들웨어를 router.use(authMiddleware) 게이트 형태로 통일. ★혼합 라우터 주의 — auth.ts(공개 15 + 보호 9)·subscription.ts(공개 /plans·/webhook/toss + 보호)에 일괄 router.use 를 걸면 공개 엔드포인트까지 보호돼 로그인·토스웹훅이 깨진다. 따라서 혼합 라우터는 공개/보호 서브라우터로 분리(예: auth-public.router.ts vs auth-admin.router.ts) 하거나 명시 예외 목록으로 처리(실행 시 master 와 분리 vs 예외 택일). 균일-보호 라우터만 router.use 적용. sse 전용 인증·/api 전역마운트 적용범위 보존, inputStore·user-preference 이중적용 정리, error-handling idiom(errorCatch/next/try-catch) 통일 포함. ★인증 적용범위 절대 무변경 — 골든 재생 + 전/후 인증분류(공개16·route-custom-auth·global-auth173) 대조로 공개=토큰없이 200·보호=401 단언.

🔴 /dev-build data-craft

---

## 로드맵 설명

data-craft-server 진입→엔드포인트(라우터) 레이어 6축 읽기전용 감사(2026-06-25)에서 드러난 모든 문제를 권장 순서로 해결하는 **순수 리팩토링** 로드맵이다.

**#1 절대원칙: 기존 기능을 절대 망가뜨리지 않는다.** 모든 단계는 HTTP 경로·메서드·요청/응답·인증 적용범위·부작용을 동결한 채 구조만 바꾼다. 이를 보장하기 위해 **P1에서 파서-독립 골든 요청→응답 스냅샷 하니스**를 먼저 만들고, 이후 매 단계가 골든을 재생해 회귀 0 을 확인한다(spec-dashboard 추출기는 그 자신이 리팩토링 대상이라 P6/P8에서 신뢰도가 떨어지므로 보조 미터로만 사용).

**순서(권장)**: 안전망(P1) → 버그(P2 authLimiter TS2742·P3 CALL_ID 복붙) → 정리(P4 죽은코드·P5 import) → 컨벤션 대공사(P6 명명 전수·P7 비즈로직 추출·P8 인증형태 통일) → 최종 빌드 검증(P9 dev-build).

**전 단계 순차 실행**(병렬 금지): 모두 같은 repo(data-craft-server) i-dev 를 건드려 동시 머지 시 충돌·회귀 위험이 있고, 특히 P6·P7·P8 은 라우터 파일을 중복 접촉한다.

**위험 지도**: P8(인증형태)이 최고위험 — 혼합 라우터에 일괄 router.use 를 걸면 공개 엔드포인트(로그인·토스웹훅)가 보호돼 깨진다. advisor 검증에서 이 구조적 충돌이 적발되어, P8 은 혼합 라우터 분리 또는 명시 예외로 처리하고 공개 엔드포인트 보존을 골든으로 단언하도록 설계했다. 보안 측면 인증홀은 감사 결과 0(전역 /api 마운트가 건전)이므로 이 로드맵은 신규 구멍을 만들지 않는 것이 핵심.

**커버리지**: 감사 6축 발견 전부 포함 — 명명(P6)·비즈로직(P7)·import 위치(P5)·TS2742(P2)·인증형태(P8)·기타(P3 CALL_ID·P4 죽은코드·P5 promotion import·P8 error-idiom). 실행은 각 프롬프트를 master 가 위→아래 순차로 수동 실행한다.
