---
targets:
  - name: data-craft
    cwd: /Users/starbox/Documents/GitHub/data-craft
    role: FE
    type: monorepo
    dev_command: pnpm dev
    port: 5173
    cache_paths: []
    lint_command: pnpm typecheck:all && pnpm lint
  - name: data-craft-mobile
    cwd: /Users/starbox/Documents/GitHub/data-craft-mobile
    role: FE
    type: monorepo
    dev_command: pnpm dev
    port: 5174
    cache_paths: []
    lint_command: pnpm typecheck
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
---

# data-craft — dev 환경 규정

## env 정책 (4개 공용)

- 단일 `.env` 정책: 4개 저장소 전부 동일한 env 사용. 개발 / 프로덕트 공용. 모든 브랜치 공유.
- env 파일은 각 저장소에서 **git-tracked** (마스터 명시 정책).
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

## lint 정책 (확정)

- `data-craft` lint gate = `pnpm typecheck:all && pnpm lint` (직렬 — 타입체크 + eslint 둘 다, 마스터 명시).
- 타입체크 실패 시 eslint 미실행 (직렬 `&&` 단락 평가).
- 나머지 3개 프로젝트 lint 는 기존 유지.

## 기타

- `data-craft`, `data-craft-mobile` 은 pnpm workspace + 모노레포 (`packages/`, `apps/`). `dev-build` 가 모노레포 선택 UI 노출.
- `data-craft-server` 는 `nodemon + ts-node` 기반. `SERVER_PORT=8000` env 변수 기반 (env 참조).

## 보안 정책

- **인증 — refresh token 채널**: 서버는 refresh token 을 `HttpOnly; Secure` 쿠키로만 발급하며 `SameSite` 는 환경 분기한다 — production = `None` (cross-site API 토폴로지 정합, `data-craft-server/src/utils/cookie.ts`), dev = `Lax`. localStorage / sessionStorage / IndexedDB 등 JS 접근 가능 영역 저장 금지. JSON response body 에 `refreshToken` 키를 포함하지 않는다 (signin / autoSignin / refresh rotation 전부).
- **인증 — access token 채널**: access token 은 모듈 스코프 또는 인메모리 스토어에만 보관. 보호된 API 호출은 `Authorization: Bearer` 헤더 사용. request body 의 `accessToken` 키 사용 금지.
- **인증 — origin 전략 (cross-site 승인 — data-craft-server #160)**: 현 배포 토폴로지는 cross-site 다 — FE = `https://datacraft.ai.kr` (gh-pages CNAME), API = `https://d3u7b7cxusjkuc.cloudfront.net` (CloudFront). 두 호스트는 eTLD+1 이 달라 refresh 쿠키는 서드파티(cross-site) 쿠키다. 이에 prod refresh 쿠키는 `SameSite=None; Secure` 를 **승인된 표준**으로 채택한다 (HTTPS 정합 확인됨). `funshare-inc.github.io` 등 gh-pages 기본 도메인 직접 접속은 비표준 (CORS allowlist 미포함) — 정식 client origin 은 `datacraft.ai.kr` 단일. **향후 과제 (미확정 로드맵 후보)**: API 를 `api.datacraft.ai.kr` 등 same-site 서브도메인으로 이전해 first-party 쿠키화하면 서드파티 쿠키 차단 브라우저(Safari ITP / Brave / Chrome 시크릿) 호환 문제를 근본 해소.
- **시크릿**: 자격 평문 (이메일·비밀번호·API 키 등) 을 소스 트리에 두지 않는다. dev 자동 로그인 편의는 `.env.local` 또는 동등한 gitignored 파일을 통해서만 주입. `.env.example` 은 키만 공개, 값은 공백. dev fallback 분기로 `.env.DEV` 에 평문을 두는 패턴도 금지 (git 이력 잔존 위험).
- **의존성**: 신규 / 유지 의존성에 `npm/pnpm audit` high 이상 취약 항목이 있으면 (a) 즉시 제거 가능한지 검증 → 제거, (b) 불가능하면 대체 검토 또는 마스터 명시 승인. 미사용 의존성은 발견 시 즉시 제거.
- **iframe srcDoc**: 동적 HTML 을 `srcDoc / srcdoc` 에 주입 시 DOMPurify 등 sanitizer 통과 필수. `data-viewer` / `sub-data-viewer` / `external-data-viewer` 의 print 경로 동일 적용 (preview 경로 예외 없음).
- **새 창 열기**: `window.open` 호출 시 세 번째 인자에 `'noopener,noreferrer'` 사용 의무. 반환 window 의 메서드 (`document.write` / `print` 등) 를 호출해야 하는 경우 `window.open` 패턴 자체를 iframe 기반 대안으로 대체 검토.
