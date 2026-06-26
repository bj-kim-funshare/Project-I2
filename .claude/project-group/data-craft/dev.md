---
targets:
  - name: data-craft
    cwd: /Users/starbox/Documents/GitHub/data-craft
    role: FE
    type: project
    dev_command: pnpm dev
    port: 5173
    cache_paths: []
    lint_command: pnpm typecheck:all && pnpm lint
  - name: data-craft-mobile
    cwd: /Users/starbox/Documents/GitHub/data-craft-mobile
    role: FE
    type: project
    dev_command: flutter run -d chrome --web-port=5174 --dart-define-from-file=dev_login.json
    port: 5174
    cache_paths: [.dart_tool, build]
    lint_command: flutter analyze
  - name: data-craft-ai-preview
    cwd: /Users/starbox/Documents/GitHub/data-craft-ai-preview
    role: FE
    type: project
    dev_command: npm run dev
    port: 3000
    cache_paths: []
    lint_command: npm run lint
  - name: data-craft-server
    cwd: /Users/starbox/Documents/GitHub/data-craft-server
    role: BE
    type: project
    dev_command: pnpm dev
    port: 8000
    cache_paths: []
    lint_command: pnpm lint
  - name: data-craft-admin
    cwd: /Users/starbox/Documents/GitHub/data-craft-admin
    role: FE
    type: project
    dev_command: pnpm dev
    port: 5175
    cache_paths: []
    lint_command: pnpm typecheck && pnpm lint
  - name: data-craft-admin-server
    cwd: /Users/starbox/Documents/GitHub/data-craft-admin-server
    role: BE
    type: project
    dev_command: pnpm dev
    port: 8100
    cache_paths: []
    lint_command: pnpm lint
---

# data-craft — dev 환경 규정

## env 정책 (역할별 구분)

> 2026-06-15 정정: 기존 "전 저장소 git-tracked / 4개 공용" 선언은 FE 현실(시크릿 보유 → gitignore)과 어긋나 pre-deploy 오탐을 유발했다. 역할별로 명확화하고 §보안정책과 정합시킨다. (deploy.md `env_management` 값과 1:1 대응.)

- **BE (`data-craft-server`, `data-craft-admin-server`) = git-tracked (시크릿 포함)**: 런타임 `.env` 를 **시크릿 값까지 포함해** git 에 커밋한다 (`JWT_*` 서명키·`DB_PASSWORD`·`PG_PASSWORD(_PROD)`·`BILLING_MASTER_KEY`·`SMTP_PASSWORD`·`NTS_API_KEY`·`SENDBIRD_API_TOKEN(_PROD)` 등). funshare-inc **사설(private) GitHub 조직 저장소** 전제 위에서 경영측이 채택한 표준이다 (2026-06-22 확정). 개발/프로덕트 공용 단일 env, 환경별 차등은 `{NAME}`/`{NAME}_PROD` 페어 + `NODE_ENV` 분기 (아래 §"env 페어 패턴"). 단 `data-craft-admin-server` 는 `ADMIN_JWT_SECRET` + dev/prod 토글 + `.env.local` 분리를 추가 운영(공용 단일 env 와 별개 — db.md 참조). 잔여 운영 권고(강제 아님): git 이력 영구 박제·오프보딩 무력화 안 됨을 감안해 핵심 키(`JWT_*` 서명키·`BILLING_MASTER_KEY`)는 별도 로테이트 정책 운영.
- **FE/클라이언트 (`data-craft`, `data-craft-mobile`, `data-craft-ai-preview`, `data-craft-admin`) = code-constants**: 시크릿(`VITE_TOSS_CLIENT_KEY`·`VITE_DEV_*`·`VITE_ADMIN_*`) 보유 + prod 설정이 코드/빌드에 컴파일되므로 `.env` 를 **gitignore** 하고 `.env.local`(dev 실값) + `.env.example`(커밋 키 템플릿)로 운영한다 (§보안정책 정합). prod 빌드/배포 산출물에 git-tracked `.env` 불필요 — 예: `data-craft` 는 `env.ts resolveUrl` 이 prod URL 강제, `data-craft-mobile` 은 `lib/config/web_config.dart` 코드 상수. (타겟별 상세 = deploy.md §env 관리.)
- (FE 결제) `VITE_TOSS_CLIENT_KEY` 는 코드 가드가 없어 `.env.local` 값이 그대로 prod 번들에 박힌다. 현재 테스트키(`test_ck_…`)가 prod 정상(라이브 결제 전) — **라이브 결제 전환 시 FE 빌드 전 `.env.local` 토스키를 라이브키로 교체 필수.**
- 본 정책 파일에는 시크릿 값을 적재하지 않음 (I2 harness 별도 저장소이므로).

## env 환경별 차등 변수 표준 — BE 페어 패턴 (BE 운영 표준 — v001.143.0 도입)

단일 git-tracked `.env` 정책 (위 절) 위에 환경별로 값이 달라야 하는 변수는 `data-craft-server` (BE, Node 런타임) 에서 다음 페어 패턴으로 운영한다.

### 명명 규칙
- 공통 / dev fallback: `{NAME}`
- prod-only: `{NAME}_PROD`

### 코드 분기
`process.env.NODE_ENV === 'production'` 일 때 `{NAME}_PROD` 채택, 그 외 `{NAME}` 폴백.

### 미설정 가드
prod 환경에서 `{NAME}_PROD` 미설정 시 `{NAME}_PROD_NOT_CONFIGURED` 식별자로 즉시 throw — dev 값으로의 사일런트 회귀 차단. 구현체는 application-internal error class (예: data-craft-server `InternalServerError`).

### 도입 사례
- v001.143.0 (#83): `data-craft-server/src/services/email.service.ts` `getFrontendUrl()` — `FRONTEND_URL` / `FRONTEND_URL_PROD` 페어, `FRONTEND_URL_PROD_NOT_CONFIGURED` throw. `.env` 에 `FRONTEND_URL_PROD=https://datacraft.ai.kr` 추가, dev 값 `FRONTEND_URL=http://localhost:5173` 은 양측 보존 통합본 (v001.142.0 / #82) 그대로 유지.

### 신규 변수 추가 체크리스트
1. `.env` 에 `{NAME}` + `{NAME}_PROD` 두 줄 추가 (양측 보존 통합본 원칙 — 모든 멤버 레포 + EC2 동기).
2. 코드 사용 지점에 NODE_ENV 분기 + 미설정 가드 throw 도입.
3. 정적 토큰 매칭 e2e 테스트 추가 권장 (`{NAME}_PROD_NOT_CONFIGURED` / `process.env.NODE_ENV === 'production'`) — 회귀 방지.

### 비-차등 변수
`SERVER_URL=0.0.0.0` 처럼 모든 환경에서 동일 값으로 동작하는 항목은 페어 분리 불필요 — 단일 라인 유지 (v001.142.0 선택 사례).

## 포트 정책 (확정)

- `data-craft` = 5173 (Vite 기본).
- `data-craft-mobile` = 5174 (리더와 충돌 회피, 마스터 명시 지정).
- `data-craft-ai-preview` = 3000 / `data-craft-server` = 8000.
- `data-craft-admin` = 5175 / `data-craft-admin-server` = 8100 (기존 포트 충돌 회피, Roadmap-7 신규).

## 관리자 콘솔 2저장소 (Roadmap-7 신규 — 마스터 명시)

- `data-craft-admin`(FE) / `data-craft-admin-server`(BE) 는 **배포 제외 · `pnpm dev` 전용** (deploy.md 참조). dev-start 기동 대상은 FE 표준이나 본 2종은 운영자 로컬 콘솔이라 master 가 필요 시 직접 기동.
- `data-craft-admin-server` 는 **별도 pg 풀 2개** 운영: ① 데이터 토글과 분리된 **고정 dev psql 인증 풀**(`admin_email_verification` — 고정 단일 계정 2단계 로그인용), ② dev/prod 런타임 토글 **데이터 풀**(프로모션 CRUD·분석 읽기, `PG_*`/`PG_*_PROD` 재활용). 인증 코드를 토글된 prod psql 에 쓰지 말 것. (db.md 참조)
- 관리자 인증 토큰은 data-craft `JWT_*` 와 분리된 별도 키 `ADMIN_JWT_SECRET`. 자격증명(고정 계정)은 env 보관·비밀번호 해시, 소스 하드코딩 금지.

## lint 정책 (확정)

- `data-craft` lint gate = `pnpm typecheck:all && pnpm lint` (직렬 — 타입체크 + eslint 둘 다, 마스터 명시).
- 타입체크 실패 시 eslint 미실행 (직렬 `&&` 단락 평가).
- **(2026-06-26 모노레포 폐기 #494 반영)** `data-craft` 단일 앱화로 `build:packages` **폐기**·`typecheck:all`=`tsc -p tsconfig.app.json`(turbo 제거). 스크립트명 보존돼 lint gate 명령(`pnpm typecheck:all && pnpm lint`) **무변경**. ⚠️ 이전 "fresh 워크트리 `install`+`build:packages` 선행" 트랩은 **해소** — 이제 `pnpm install` 후 `typecheck:all` 자족(패키지·turbo 없음). ⚠️ CI `pr-ci.yml` ERR_PNPM_BAD_PM_VERSION(workflow v10 vs packageManager `pnpm@10.22.0`) 1개월째 깨짐 = **master 무시 지시**(별도 수정·로컬 lint gate 가 안전망).
- **`data-craft-mobile` lint gate = `flutter analyze` 단독 (순수 Flutter repo — 2026-06-18 재정정)**: 이 저장소는 pnpm 모노레포(`apps/web` Vite 웹 번들)에서 순수 Flutter 앱으로 전환됐다 — 루트 `pubspec.yaml`(`lib/`/`web/`/`android/`/`ios/`), 루트 `package.json` 부재. 따라서 `pnpm typecheck` 는 실행 불가하며 lint gate 는 `flutter analyze`(Flutter `lib/` 정적분석) 단독이다. fresh 워크트리는 `flutter pub get` 선행 필요. (이력: 2026-06-17 에는 apps/web React 가 공존하는 하이브리드로 보고 `flutter analyze && pnpm typecheck` 로 교정했으나, 이후 apps/web 소스가 제거되어 본 재정정으로 대체.)
- 나머지 2개 프로젝트(ai-preview / server / admin 계열) lint 는 기존 유지.

## 기타

- `data-craft` 는 **단일 앱**(2026-06-26 모노레포 전면 폐기 #494 — `packages/`·`pnpm-workspace.yaml`·`turbo.json` 소멸, 6 패키지 `src/_packages/<name>/` 흡수). `dev-build` 모노레포 선택 UI **비대상**. `data-craft-mobile` 도 순수 Flutter 단일 프로젝트(`type: project`)로 모노레포 아님 — `dev-build` 모노레포 선택 UI 비대상.
- `data-craft-server` 는 `nodemon + ts-node` 기반. `SERVER_PORT=8000` env 변수 기반 (env 참조).

## 보안 정책

- **인증 — refresh token 채널**: 서버는 refresh token 을 `HttpOnly; Secure` 쿠키로만 발급하며 `SameSite` 는 환경 분기한다 — production = `None` (cross-site API 토폴로지 정합, `data-craft-server/src/utils/cookie.ts`), dev = `Lax`. localStorage / sessionStorage / IndexedDB 등 JS 접근 가능 영역 저장 금지. JSON response body 에 `refreshToken` 키를 포함하지 않는다 (signin / autoSignin / refresh rotation 전부).
- **인증 — access token 채널**: access token 은 모듈 스코프 또는 인메모리 스토어에만 보관. 보호된 API 호출은 `Authorization: Bearer` 헤더 사용. request body 의 `accessToken` 키 사용 금지.
- **인증 — origin 전략 (cross-site 승인 — data-craft-server #160)**: 현 배포 토폴로지는 cross-site 다 — FE = `https://datacraft.ai.kr` (gh-pages CNAME), API = `https://d3u7b7cxusjkuc.cloudfront.net` (CloudFront). 두 호스트는 eTLD+1 이 달라 refresh 쿠키는 서드파티(cross-site) 쿠키다. 이에 prod refresh 쿠키는 `SameSite=None; Secure` 를 **승인된 표준**으로 채택한다 (HTTPS 정합 확인됨). `funshare-inc.github.io` 등 gh-pages 기본 도메인 직접 접속은 비표준 (CORS allowlist 미포함) — 정식 client origin 은 `datacraft.ai.kr` 단일. **향후 과제 (미확정 로드맵 후보)**: API 를 `api.datacraft.ai.kr` 등 same-site 서브도메인으로 이전해 first-party 쿠키화하면 서드파티 쿠키 차단 브라우저(Safari ITP / Brave / Chrome 시크릿) 호환 문제를 근본 해소.
- **시크릿 (역할별 분기 — 2026-06-22 정정)**: **FE/클라이언트 (`data-craft`, `data-craft-mobile`, `data-craft-ai-preview`, `data-craft-admin`)** 는 자격 평문 (이메일·비밀번호·API 키 등) 을 소스 트리에 두지 않는다 — dev 자동 로그인 편의는 `.env.local` 또는 동등한 gitignored 파일로만 주입, `.env.example` 은 키만 공개·값 공백, `.env.DEV` 평문 fallback 패턴 금지. **BE (`data-craft-server`, `data-craft-admin-server`)** 는 위 §env 정책에 따라 funshare-inc 사설 조직 저장소에 시크릿 포함 `.env` 를 git-tracked 하는 것이 **승인된 표준**이며 (경영 결정, 2026-06-22), 보안 점검(`dev-security-inspection`)·드리프트 게이트(`pre-deploy`)는 이를 보안 결함으로 보고하지 않는다. 잔여 운영 권고(강제 아님)는 §env 정책 BE 항목의 핵심 키 로테이트 권고를 따른다.
- **의존성**: 신규 / 유지 의존성에 `npm/pnpm audit` high 이상 취약 항목이 있으면 (a) 즉시 제거 가능한지 검증 → 제거, (b) 불가능하면 대체 검토 또는 마스터 명시 승인. 미사용 의존성은 발견 시 즉시 제거.
- **iframe srcDoc**: 동적 HTML 을 `srcDoc / srcdoc` 에 주입 시 DOMPurify 등 sanitizer 통과 필수. `data-viewer` / `sub-data-viewer` / `external-data-viewer` 의 print 경로 동일 적용 (preview 경로 예외 없음).
- **새 창 열기**: `window.open` 호출 시 세 번째 인자에 `'noopener,noreferrer'` 사용 의무. 반환 window 의 메서드 (`document.write` / `print` 등) 를 호출해야 하는 경우 `window.open` 패턴 자체를 iframe 기반 대안으로 대체 검토.
